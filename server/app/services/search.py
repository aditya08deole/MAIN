from typing import List, Dict, Set, Optional
import asyncio
from app.models.all_models import Node

class SearchService:
    """
    In-Memory Search Engine for Nodes.
    Provides sub-millisecond fuzzy search capabilities.
    """
    def __init__(self):
        # Inverted Index: "keyword" -> {node_id_1, node_id_2}
        self.index: Dict[str, Set[str]] = {}
        # Storage for full objects (optional, or just ID refs)
        # self.documents: Dict[str, dict] = {} 
        self._lock = asyncio.Lock()

    def _tokenize(self, text: str) -> List[str]:
        """Convert text to searchable tokens (lowercase, alphanumeric)."""
        if not text:
            return []
        return [t.lower() for t in text.split() if t]

    def _generate_prefixes(self, token: str) -> List[str]:
        """Generate all prefixes for a token to allow partial matching."""
        return [token[:i] for i in range(1, len(token) + 1)]

    async def add_node(self, node: Node):
        """Index a single node."""
        async with self._lock:
            node_id = str(node.id)
            
            # Fields to index
            searchable_text = f"{node.node_key} {node.label} {node.category} {node.location_name or ''} {node.status}"
            tokens = self._tokenize(searchable_text)
            
            for token in tokens:
                # Add exact token
                if token not in self.index:
                    self.index[token] = set()
                self.index[token].add(node_id)
                
                # Add prefixes for "type-ahead" feel
                for prefix in self._generate_prefixes(token):
                    if prefix not in self.index:
                        self.index[prefix] = set()
                    self.index[prefix].add(node_id)

    async def remove_node(self, node_id: str):
        """Remove a node from the index (expensive, simplistic version)."""
        async with self._lock:
            # For a simple inverted index, removing is hard without a reverse map.
            # For MVP, we might just ignore or rebuild periodically.
            # Implementing naive removal:
            for token in self.index:
                if node_id in self.index[token]:
                    self.index[token].remove(node_id)

    async def search(self, query: str) -> List[str]:
        """Return list of Node IDs matching the query."""
        if not query:
            return []
            
        async with self._lock:
            query_tokens = self._tokenize(query)
            if not query_tokens:
                return []
            
            # Start with results for the first token
            first_token = query_tokens[0]
            if first_token not in self.index:
                return []
            
            result_ids = self.index[first_token].copy()
            
            # Intersect with results for subsequent tokens (AND logic)
            for token in query_tokens[1:]:
                if token in self.index:
                    result_ids.intersection_update(self.index[token])
                else:
                    return [] # One token didn't match anything
            
            return list(result_ids)

    async def search_with_sql_fallback(self, query: str, db=None) -> List[str]:
        """
        P28: Search with in-memory index first, fall back to SQL search_nodes() function.
        """
        # Try in-memory first
        results = await self.search(query)
        if results:
            return results
        
        # P28: Fall back to SQL function (pg_trgm fuzzy search)
        if db is not None:
            try:
                from sqlalchemy import text
                sql_result = await db.execute(
                    text("SELECT id FROM search_nodes(:term)"),
                    {"term": query}
                )
                return [str(row[0]) for row in sql_result.all()]
            except Exception:
                pass  # SQL function may not exist yet
        
        return []

    async def rebuild_index(self, nodes: List[Node]):
        """Clear and rebuild valid index from list of nodes."""
        async with self._lock:
            self.index.clear()
        
        for node in nodes:
            await self.add_node(node)
            
        print(f"SEARCH: Index rebuilt with {len(nodes)} nodes.")

# Global Instance
search_service = SearchService()
