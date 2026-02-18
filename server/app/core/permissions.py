from enum import Enum
from typing import List

class UserRole(str, Enum):
    SUPERADMIN = "superadmin"
    REGION_ADMIN = "region_admin"
    COMMUNITY_ADMIN = "community_admin"
    CUSTOMER = "customer"

class Permission(str, Enum):
    # System
    SYSTEM_CONFIG_WRITE = "system:config:write"
    
    # Community
    COMMUNITY_CREATE = "community:create"
    COMMUNITY_READ = "community:read"
    COMMUNITY_UPDATE = "community:update"
    
    # Device
    DEVICE_PROVISION = "device:provision"
    DEVICE_READ = "device:read"
    DEVICE_CONTROL = "device:control"

    # User
    USER_MANAGE = "user:manage"

# Role -> Permissions Mapping
ROLE_PERMISSIONS = {
    UserRole.SUPERADMIN: [
        Permission.SYSTEM_CONFIG_WRITE, 
        Permission.COMMUNITY_CREATE, 
        Permission.COMMUNITY_READ, 
        Permission.COMMUNITY_UPDATE,
        Permission.DEVICE_PROVISION,
        Permission.DEVICE_READ,
        Permission.DEVICE_CONTROL,
        Permission.USER_MANAGE
    ],
    UserRole.REGION_ADMIN: [
        Permission.COMMUNITY_READ,
        Permission.COMMUNITY_UPDATE,
        Permission.DEVICE_READ,
        Permission.USER_MANAGE # within region
    ],
    UserRole.COMMUNITY_ADMIN: [
        Permission.COMMUNITY_READ,
        Permission.DEVICE_PROVISION,
        Permission.DEVICE_READ,
        Permission.USER_MANAGE # within community
    ],
    UserRole.CUSTOMER: [
        Permission.DEVICE_READ,
        Permission.DEVICE_CONTROL # own devices only
    ]
}

def has_permission(user_role: str, required_permission: Permission) -> bool:
    """Check if a role has the required permission."""
    # Convert string role to Enum if valid
    try:
        role_enum = UserRole(user_role)
    except ValueError:
        return False # Invalid role
    
    allowed = ROLE_PERMISSIONS.get(role_enum, [])
    return required_permission in allowed
