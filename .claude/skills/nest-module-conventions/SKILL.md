---
name: nest-module-conventions
description: Layering, DTO and error-mapping conventions for NestJS modules in this repo.
---
- Controller: HTTP only. Service: rules. Repository: only code that imports Mongoose models; translates E11000 to DuplicateEmailError.
- Sole exception: HealthService pings through the Mongoose Connection (no models, no data access). Controllers never touch infrastructure.
- DTOs use class-validator with the shared password-policy constant. ValidationPipe is whitelist + forbidNonWhitelisted.
- All errors flow through HttpExceptionFilter to the single envelope `{ statusCode, error, message, details?, requestId }`.
