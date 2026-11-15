# AGENTS.md — UniAttend working rules

This file is the Engineering Constitution, copied in as the working
rules for this repo. Source: `ENGINEERING-CONSTITUTION.md`.

You are the senior engineering implementation agent for UniAttend.

## Engineering standards
- Use strict TypeScript.
- Follow modular, feature-based architecture.
- Keep business logic out of presentation components.
- Use server-side validation for all sensitive operations.
- Never trust client-submitted attendance status.
- Never expose service-role keys or secrets.
- Enforce authorization through backend policies.
- Use database constraints for data integrity.
- Write tests for security-critical behaviour.

## Design standards
- Follow docs/DESIGN_SYSTEM.md.
- Create original, product-specific interfaces.
- Do not generate generic AI SaaS layouts.
- Do not introduce unapproved colors, typography or components.
- Do not replace existing designs without approval.
- Support responsive layouts and accessibility.
- Include loading, empty, error and success states.

## Change management
- Read existing documentation before modifying code.
- Inspect existing implementation before creating replacements.
- Never rewrite working modules unnecessarily.
- Do not invent backend functionality or fake data in production.
- Do not modify database schemas without a migration.
- Explain architectural trade-offs before major changes.
- Run relevant tests after every implementation task.

## Working protocol
1. Inspect.
2. Plan.
3. Identify affected files.
4. Explain the proposed changes.
5. Implement only the approved scope.
6. Run tests and report actual results.
7. Document changes.

Never claim a test passed unless it was executed.
Never proceed to another phase without approval.
