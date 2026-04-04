import os
import json
import torch
import numpy as np
from transformers import AutoTokenizer, AutoModel
import torch.nn.functional as F
import pickle
from datetime import datetime

# Using a lightweight but powerful sentence embedding model
MODEL_NAME = 'sentence-transformers/all-MiniLM-L6-v2'


class RAGEngine:
    """
    Retrieval-Augmented Generation Engine for EchoSensei.

    This engine provides semantic search over historical patient/session data
    using sentence embeddings. It enables the LLM to ground its responses in
    relevant past clinical context, improving diagnostic accuracy and consistency.

    Architecture:
        1. INDEXING: When new data is extracted from a conversation turn, it is
           embedded using a sentence-transformer model and stored in a local
           vector index (pickle file).
        2. RETRIEVAL: Before generating an LLM response, the user's query is
           embedded and compared against the index using cosine similarity.
        3. AUGMENTATION: The top-K most relevant historical context chunks are
           injected into the LLM prompt as additional context.
    """

    def __init__(self):
        print(f"[RAG] 🧠 Initializing RAG Engine with {MODEL_NAME}...")
        self.model_ready = False
        try:
            self.tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
            self.model = AutoModel.from_pretrained(MODEL_NAME)
            # Ensure model is on CPU for stability
            self.model.cpu()
            
            # Apply PyTorch Dynamic Quantization to INT8 to massively improve inference latency 
            # for CPU-bound environments up to 50%
            self.model = torch.quantization.quantize_dynamic(
                self.model, {torch.nn.Linear}, dtype=torch.qint8
            )
            
            self.model.eval()
            self.model_ready = True
            print(f"[RAG] ✅ Embedding model loaded successfully (Quantized INT8).")
        except Exception as e:
            print(f"[RAG] ❌ Failed to load embedding model: {e}")
            self.tokenizer = None
            self.model = None

        self.index_file = "data/rag_index.pkl"
        self.index = []  # List of { 'text': str, 'embedding': np.array, 'metadata': dict }
        self.load_index()

    def _mean_pooling(self, model_output, attention_mask):
        """Mean pooling over token embeddings, weighted by attention mask."""
        token_embeddings = model_output[0]
        input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
        return torch.sum(token_embeddings * input_mask_expanded, 1) / torch.clamp(input_mask_expanded.sum(1), min=1e-9)

    def get_embedding(self, text):
        """
        Generate a normalized 384-dimensional embedding for a text string.
        Uses the MiniLM-L6-v2 sentence transformer.
        Returns None if the model is not loaded.
        """
        if not self.model or not self.tokenizer:
            return None

        try:
            # Clean and limit text length for embedding
            text = text.strip()[:512]
            encoded_input = self.tokenizer([text], padding=True, truncation=True, return_tensors='pt')

            with torch.no_grad():
                model_output = self.model(**encoded_input)

            sentence_embeddings = self._mean_pooling(model_output, encoded_input['attention_mask'])
            # L2 normalize so dot product = cosine similarity
            sentence_embeddings = F.normalize(sentence_embeddings, p=2, dim=1)
            return sentence_embeddings[0].cpu().numpy()
        except Exception as e:
            print(f"[RAG] ❌ Embedding error: {e}")
            return None

    def add_to_index(self, text, metadata):
        """
        Add a text chunk to the vector index.
        
        Args:
            text: The text to embed and index (e.g., extracted clinical data summary)
            metadata: Dict with context info, e.g.:
                - session_id: which session this came from
                - type: 'extracted_data', 'user_utterance', 'historical_data'
                - domain: 'healthcare', 'finance', etc.
                - timestamp: ISO timestamp
        """
        if len(text.strip()) < 10:
            return False

        embedding = self.get_embedding(text)
        if embedding is not None:
            self.index.append({
                'text': text,
                'embedding': embedding,
                'metadata': metadata,
                'timestamp': metadata.get('timestamp', datetime.now().isoformat())
            })
            self.save_index()
            print(f"[RAG] 📥 Indexed: \"{text[:60]}...\" (Total: {len(self.index)} chunks)")
            return True
        return False

    def save_index(self):
        """Persist the vector index to disk."""
        os.makedirs("data", exist_ok=True)
        try:
            with open(self.index_file, "wb") as f:
                pickle.dump(self.index, f)
        except Exception as e:
            print(f"[RAG] ❌ Failed to save index: {e}")

    def load_index(self):
        """Load the vector index from disk if it exists."""
        if os.path.exists(self.index_file):
            try:
                with open(self.index_file, "rb") as f:
                    self.index = pickle.load(f)
                print(f"[RAG] ✅ Loaded {len(self.index)} context chunks from index.")
            except Exception as e:
                print(f"[RAG] ⚠️ Could not load index: {e}")
                self.index = []
        else:
            print(f"[RAG] ℹ️ No existing index found. Starting fresh.")

    def search(self, query, top_k=3, min_score=0.4):
        """
        Perform semantic search over the vector index.

        Args:
            query: The search query text (e.g., user's current message)
            top_k: Maximum number of results to return
            min_score: Minimum cosine similarity threshold (0.0 to 1.0)

        Returns:
            List of dicts with 'text', 'metadata', and 'score' keys,
            sorted by descending similarity score.
        """
        if not self.index:
            return []

        query_embedding = self.get_embedding(query)
        if query_embedding is None:
            return []

        # Calculate cosine similarity (dot product since embeddings are L2-normalized)
        results = []
        for item in self.index:
            score = float(np.dot(query_embedding, item['embedding']))
            if score >= min_score:
                results.append({
                    'text': item['text'],
                    'metadata': item['metadata'],
                    'score': round(score, 4)
                })

        # Sort by score descending
        results.sort(key=lambda x: x['score'], reverse=True)
        return results[:top_k]

    def clear_index(self):
        """Clear the entire vector index."""
        self.index = []
        if os.path.exists(self.index_file):
            os.remove(self.index_file)
        print("[RAG] 🗑️ Index cleared.")

    def get_stats(self):
        """Return statistics about the current index."""
        if not self.index:
            return {
                "total_chunks": 0,
                "model_loaded": self.model_ready,
                "model_name": MODEL_NAME,
                "index_file": self.index_file,
                "sessions_indexed": 0,
                "types": {}
            }

        sessions = set()
        types = {}
        for item in self.index:
            meta = item.get('metadata', {})
            sid = meta.get('session_id', 'unknown')
            sessions.add(sid)
            t = meta.get('type', 'unknown')
            types[t] = types.get(t, 0) + 1

        return {
            "total_chunks": len(self.index),
            "model_loaded": self.model_ready,
            "model_name": MODEL_NAME,
            "index_file": self.index_file,
            "sessions_indexed": len(sessions),
            "types": types
        }

    def load_knowledge_base(self, kb_path="data/clinical_knowledge_base.json"):
        """
        Load pre-built clinical knowledge base (AI4Bharat-inspired dataset)
        into the RAG index. Only indexes entries that aren't already in the index.
        """
        if not os.path.exists(kb_path):
            print(f"[RAG] ℹ️ No knowledge base found at {kb_path}")
            return 0

        # Check if knowledge base is already indexed
        existing_kb = sum(1 for item in self.index if item.get('metadata', {}).get('source') == 'ai4bharat_clinical')
        if existing_kb > 0:
            print(f"[RAG] ✅ Knowledge base already indexed ({existing_kb} entries). Skipping.")
            return existing_kb

        try:
            with open(kb_path, "r", encoding="utf-8") as f:
                kb_data = json.load(f)

            indexed = 0
            for entry in kb_data:
                text = entry.get("text", "")
                metadata = entry.get("metadata", {})
                metadata["source"] = "ai4bharat_clinical"
                if self.add_to_index(text, metadata):
                    indexed += 1

            print(f"[RAG] 📚 Knowledge base loaded: {indexed}/{len(kb_data)} clinical entries indexed.")
            return indexed
        except Exception as e:
            print(f"[RAG] ❌ Failed to load knowledge base: {e}")
            return 0


# Persistent singleton instance — shared across the application
rag_engine = RAGEngine()

# Auto-load AI4Bharat clinical knowledge base on startup
rag_engine.load_knowledge_base()
