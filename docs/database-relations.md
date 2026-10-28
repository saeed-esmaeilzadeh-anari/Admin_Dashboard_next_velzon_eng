# Initial database relationships

- Category 1-to-many Product. Removing a category unlinks products rather than deleting them.
- Customer 1-to-many Order. Orders restrict customer deletion; the API archives customers instead.
- Order 1-to-many OrderItem. Order items are removed with their order.
- Product 1-to-many OrderItem. Historical order items restrict product deletion.
- User 1-to-many Order as optional creator.
- User 1-to-many Project as optional owner.
- Project 1-to-many Task. Deleting a project clears task project references.
- User 1-to-many Task as distinct optional assignee and creator relationships.
- Customer 1-to-many Ticket as optional customer relationship.
- User 1-to-many Ticket as distinct optional assignee and creator relationships.
- User 1-to-many AuditLog as optional actor.

The Prisma schema and initial SQL migration are the canonical definitions.
