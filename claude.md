# Project Management System — Claude Context

## System Overview
A scalable, multi-role Project Management System with PostgreSQL-backed architecture and real-time data access.

---

## Database Design (PostgreSQL)

### Core Tables

#### Users
- id (PK)
- name
- email (unique)
- password_hash
- theme_preference (light/dark)
- created_at

---

#### Roles
- id (PK)
- name (Business User, Program Manager, etc.)

---

#### User_Roles (Dual Role Support)
- id (PK)
- user_id (FK)
- role_id (FK)

---

#### Organizations
- id (PK)
- name
- type (customer/partner)

---

#### Programs
- id (PK)
- name
- description
- created_by

---

#### Projects
- id (PK)
- program_id (FK)
- name
- description
- start_date
- end_date
- status
- project_manager_id

---

#### Tasks
- id (PK)
- project_id (FK)
- title
- description
- status
- assigned_to
- priority
- due_date

---

#### Issues
- id (PK)
- project_id (FK)
- title
- severity
- status
- assigned_to

---

#### Sprints
- id (PK)
- project_id (FK)
- name
- start_date
- end_date

---

#### Resources
- id (PK)
- user_id (FK)
- project_id (FK)
- allocation_percentage

---

## Schema Rules

- Use UUIDs for scalability
- Enforce foreign key constraints
- Index frequently queried fields
- Maintain audit columns:
  - created_at
  - updated_at

---

## Backend Integration

### API Design

- REST or GraphQL
- Fully stateless services
- No caching layer (strict DB reads)

### Key Services

- Auth Service
- User & Role Service
- Project Service
- Task Service
- Reporting Service

---

## Role-Based Access Control (RBAC)

- Middleware-based enforcement
- Multi-role support per user
- Context-aware permissions

---

## Theming System

### Light/Dark Mode

- Stored in `users.theme_preference`
- Applied at login
- Toggle API endpoint

---

## UI Architecture

- Role-based dynamic sidebar
- Component-level permission checks
- Modular widgets

---

## Engineering Principles (Harness Style)

### Continuous Delivery
- Automated CI/CD
- Zero-downtime deployments

### Feature Flags
- Gradual rollout
- Role-based feature enablement

### Observability
- Centralized logging
- Metrics & alerts

### Scalability
- Stateless backend
- Horizontal scaling

### Security
- JWT/OAuth authentication
- RBAC enforcement
- Data isolation

---

## Constraints

- No caching (Redis, etc.)
- Strong consistency over performance
- Backend-driven state only

---

## Future Enhancements

- AI-driven analytics
- Predictive KPIs
- Smart task assignment
- External integrations

---

## Notes for Claude

- Always account for dual-role users
- Ensure DB normalization
- Avoid assumptions of cached data
- Maintain strict API boundaries
- Follow harness engineering framework
- Capture all the logs and audit trials under admin console
- Have a landing page with get stated button

