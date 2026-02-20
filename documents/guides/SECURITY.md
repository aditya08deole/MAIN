# Security Implementation Guide

## Authentication
- **JWT (JSON Web Tokens)**: Used for stateless authentication. Tokens expire in 12 hours.
- **Hashing**: Passwords are hashed using `bcrypt` (via `passlib`).
- **OAuth2**: FastAPI's `OAuth2PasswordBearer` is used for token extraction.

## Authorization
- **RBAC**: Role-Based Access Control is enforced.
- **Dependency Injection**: `get_current_active_superuser` ensures admin-only access to sensitive endpoints.

## Data Protection
- **Pydantic Models**: Strict schema validation prevents over-posting and invalid data types.
- **SQLAlchemy**: ORM prevents SQL Injection by default.
- **CORS**: Configured to allow only specific origins (localhost, render app).

## Environment Variables
- **.env**: Local secrets are never committed.
- **pydantic-settings**: Typesafe loading of environment configurations.
