"""
Phase 17: GeoJSON Clustering Utility
Implements a simple grid-based spatial clustering algorithm for map markers.
Prevents rendering thousands of individual markers, providing smooth 60fps.
"""
from typing import List, Dict, Any, Tuple
import math

class GeoCluster:
    """
    Grid-based spatial clustering for map markers.
    Groups nearby nodes into clusters based on zoom level.
    """
    
    @staticmethod
    def cluster_nodes(nodes: List[Dict[str, Any]], zoom: int = 10, grid_size: float = 0.5) -> List[Dict[str, Any]]:
        """
        Cluster nodes based on geographic proximity.
        
        Args:
            nodes: List of dicts with 'lat', 'lng', and 'id' keys
            zoom: Current map zoom level (higher = more detail)
            grid_size: Base grid cell size in degrees (adjusted by zoom)
        
        Returns:
            List of clusters: [{"lat": centerLat, "lng": centerLng, "count": N, "node_ids": [...]}]
        """
        # Adjust grid size based on zoom (higher zoom = smaller grid = more clusters)
        adjusted_grid = grid_size / (2 ** (zoom - 10)) if zoom > 10 else grid_size * (2 ** (10 - zoom))
        adjusted_grid = max(adjusted_grid, 0.001)  # Minimum grid size
        
        grid: Dict[Tuple[int, int], List[Dict]] = {}
        
        for node in nodes:
            lat = node.get('lat', 0) or 0
            lng = node.get('lng', 0) or 0
            
            # Determine grid cell
            cell_x = int(lng / adjusted_grid)
            cell_y = int(lat / adjusted_grid)
            key = (cell_x, cell_y)
            
            if key not in grid:
                grid[key] = []
            grid[key].append(node)
        
        # Convert grid cells to clusters
        clusters = []
        for key, cell_nodes in grid.items():
            if len(cell_nodes) == 1:
                # Single node, don't cluster
                n = cell_nodes[0]
                clusters.append({
                    "lat": n.get('lat', 0),
                    "lng": n.get('lng', 0),
                    "count": 1,
                    "node_ids": [n.get('id')],
                    "is_cluster": False,
                    "label": n.get('label', ''),
                    "status": n.get('status', 'unknown')
                })
            else:
                # Multiple nodes, create cluster
                avg_lat = sum(n.get('lat', 0) or 0 for n in cell_nodes) / len(cell_nodes)
                avg_lng = sum(n.get('lng', 0) or 0 for n in cell_nodes) / len(cell_nodes)
                
                # Determine cluster status (worst status wins)
                statuses = [n.get('status', '') for n in cell_nodes]
                cluster_status = 'Alert' if 'Alert' in statuses else ('Offline' if 'Offline' in statuses else 'Online')
                
                clusters.append({
                    "lat": avg_lat,
                    "lng": avg_lng,
                    "count": len(cell_nodes),
                    "node_ids": [n.get('id') for n in cell_nodes],
                    "is_cluster": True,
                    "status": cluster_status
                })
        
        return clusters

geo_cluster = GeoCluster()
