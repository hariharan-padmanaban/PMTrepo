# Project Management System — Agent Overview

## Purpose
Defines system agents (roles), responsibilities, and interaction boundaries.

---

## System Roles (Agents)

### 1. Business Users
**Goal:** Strategic visibility

**Capabilities:**
- Portfolio overview
- Pipeline tracking
- KPIs & reports
- Timeline visualization

**Side Panel:**
- Dashboard
- Portfolio
- Pipeline
- Reports
- Timeline

---

### 2. Program Manager
**Goal:** Program governance

**Capabilities:**
- Onboard programs/projects
- Assign/reassign Project Managers
- Manage timelines
- Update project details

**Side Panel:**
- Program Dashboard
- Projects
- Assignments
- Timeline
- Reports

---

### 3. Project Manager
**Goal:** Execution

**Capabilities:**
- Resource onboarding
- WBS creation
- Task & issue management
- Agile / Waterfall execution
- Sprint management

**Side Panel:**
- Project Dashboard
- WBS / Tasks
- Issues
- Sprints
- Resources

---

### 4. Team Members
**Goal:** Task execution

**Capabilities:**
- View/update tasks
- Add comments
- Collaborate

**Side Panel:**
- My Tasks
- My Projects
- Activity Feed

---

### 5. Admin
**Goal:** Governance

**Capabilities:**
- Manage users
- Assign/revoke roles (including dual roles)
- Onboard customers/partners
- System configuration

**Side Panel:**
- Users
- Organizations
- Roles & Permissions
- Settings

---

## Role Management

- Users can have **multiple roles (dual-role support)**
- Admin can:
  - Assign roles
  - Revoke roles
  - Switch active role context (if needed)

---

## Data & Backend Rules

- PostgreSQL as primary database
- No caching layer (strict real-time consistency)
- All data must be fetched from backend APIs
- Strong schema validation

---

## Theming

- Support:
  - Light mode
  - Dark mode

- Features:
  - User preference stored in DB
  - Toggle available in UI
  - System default fallback

---

## Engineering Guidelines (Harness-Aligned)

- Microservices architecture
- API-first design
- CI/CD pipelines
- Feature flags
- Observability (logs, metrics)
- Secure RBAC enforcement

---

## Cross-Agent Principles

- Strict RBAC
- Audit logs for role changes
- Scalable modular design