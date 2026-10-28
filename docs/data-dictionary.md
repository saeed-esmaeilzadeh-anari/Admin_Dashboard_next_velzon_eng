# Initial data dictionary

This documents the first backend slice. It does not claim every field in the legacy dashboard has been mapped.

## User
- id: UUID primary key.
- name: display name.
- email: unique, normalized login email.
- passwordHash: bcrypt hash; never returned from API.
- role: ADMIN, MANAGER or USER.
- isActive: disabled users cannot authenticate.
- createdAt and updatedAt: timestamps.

## Product and Category
Product has id, name, unique SKU, optional description, decimal price, integer stock, status, optional categoryId and timestamps. Category has id, unique name, unique slug and timestamps. Product deletion archives it to preserve order history.

## Customer
Customer has id, name, optional unique email, phone, company, notes, status and timestamps. Customer deletion archives the record.

## Order and OrderItem
Order has id, unique order number, status, customerId, optional creator, subtotal, tax, total and timestamps. OrderItem has orderId, productId, quantity, unitPrice and lineTotal; each product appears once per order. Order item prices are snapshots. Tax is treated as a fixed monetary amount.

## Lead
Lead has id, name, optional email/phone/company/source, status, notes and timestamps. Statuses are NEW, CONTACTED, QUALIFIED, PROPOSAL, WON and LOST.

## Project and Task
Project has name, description, status, start/due dates, optional owner and timestamps. Task has title, description, status, priority, due date, optional project, optional assignee and creator, and timestamps.

## Ticket
Ticket has title, description, status, priority, optional customer, optional assignee and creator, and timestamps. Message threads, SLA policies and attachments remain future work.

## AuditLog
AuditLog has optional user, action, entity, entityId, JSON metadata and timestamp. The schema exists but writing logs from business actions is not wired yet.
