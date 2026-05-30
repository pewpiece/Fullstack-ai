# FastAPI Backend Security Audit Report

Audit scope: recursive review of backend project source and runtime/config artifacts under backend/.
Reviewed files: backend/app/main.py, backend/app/auth.py, backend/app/crud.py, backend/app/database.py, backend/app/models.py, backend/app/schemas.py, backend/app/routers/*.py, backend/requirements.txt, backend/Dockerfile, backend/.env.example, plus empty package marker files.
Out of scope: third-party vendored packages under backend/.venv/ and binary database file backend/sql_app.db (non-source artifact).

## 1. Executive Summary

Overall security posture: **moderate risk with several high-impact misconfigurations**.

Critical findings summary:
- **Credential exposure risk** in backend/.env.example: appears to contain real database credentials and JWT secret format.

High-risk vulnerabilities:
- Hardcoded insecure JWT fallback secret (forgeable token risk if env missing).
- Overly permissive CORS (`allow_origins=["*"]` with `allow_credentials=True`).
- No brute-force/rate limiting on auth endpoints.
- Production API documentation exposure (`/docs`, `/redoc`, `/openapi.json`) not restricted.

Recommendations overview:
- Remove credential leakage immediately and rotate compromised secrets.
- Enforce strict production configuration (fail-fast on missing secrets; no wildcard CORS).
- Add auth rate limiting and failed-login telemetry.
- Add hardening middleware and production-safe app settings.

---

## 2. Authentication & Password Security

### Findings

#### 2.1 Password hashing is implemented with bcrypt (positive)
- Severity: **Informational**
- Affected files: backend/app/auth.py, backend/app/crud.py
- Evidence:
```python
# backend/app/auth.py
return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

# backend/app/auth.py
return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
```
- Assessment: Uses bcrypt correctly with salted hashes and constant-time verification behavior from library.

#### 2.2 Missing password policy enforcement
- Severity: **Medium**
- Affected files: backend/app/schemas.py, backend/app/routers/auth.py
- Evidence:
```python
class UserRegister(BaseModel):
    email: str
    password: str
```
- Attack scenario: Weak passwords can be brute-forced faster once credential stuffing starts.
- Business impact: Increased account takeover probability.
- Recommended fix:
```python
from pydantic import BaseModel, Field, field_validator
import re

class UserRegister(BaseModel):
    email: str
    password: str = Field(min_length=12, max_length=128)

    @field_validator("password")
    @classmethod
    def strong_password(cls, value: str) -> str:
        if not re.search(r"[A-Z]", value) or not re.search(r"[a-z]", value) or not re.search(r"\d", value):
            raise ValueError("Password must include upper, lower, and numeric characters")
        return value
```

#### 2.3 No password reset flow present
- Severity: **Low**
- Affected files: backend/app/routers/auth.py
- Assessment: Absence is not a direct exploit, but no secure recovery flow can cause insecure manual resets.
- Recommendation: Add tokenized reset with single-use, short TTL, and audit logs.

---

## 3. JWT & Authentication Token Security

### Findings

#### 3.1 Insecure default JWT secret fallback
- Severity: **High**
- Affected files: backend/app/auth.py
- Evidence:
```python
SECRET_KEY: str = os.getenv("JWT_SECRET", "change-me-in-production")
```
- Attack impact: If JWT_SECRET is missing, attacker can forge valid tokens using known fallback.
- Recommended fix:
```python
SECRET_KEY = os.getenv("JWT_SECRET")
if not SECRET_KEY or len(SECRET_KEY) < 32:
    raise RuntimeError("JWT_SECRET must be set and >= 32 chars")
```

#### 3.2 Algorithm is pinned (positive)
- Severity: **Informational**
- Affected files: backend/app/auth.py
- Evidence:
```python
ALGORITHM: str = "HS256"
jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
```
- Assessment: `alg=none` style downgrade is mitigated by explicit algorithm list.

#### 3.3 No token revocation/rotation or refresh-token architecture
- Severity: **Medium**
- Affected files: backend/app/auth.py, backend/app/routers/auth.py
- Evidence:
```python
ACCESS_TOKEN_EXPIRE_DAYS: int = 7
```
- Attack impact: Stolen access token remains valid for long window; no server-side invalidation.
- Recommended fix:
- Use short-lived access tokens (5-15 min), refresh tokens with rotation.
- Add jti blacklist/denylist on logout/compromise.

#### 3.4 No issuer/audience claim validation
- Severity: **Low**
- Affected files: backend/app/auth.py
- Attack impact: Token confusion risks in multi-service deployments.
- Recommended fix:
```python
jwt.decode(
  token,
  SECRET_KEY,
  algorithms=[ALGORITHM],
  issuer="inventrack-api",
  audience="inventrack-web"
)
```

---

## 4. SQL Injection & Database Security

### Findings

#### 4.1 No direct SQL injection vector observed in application queries
- Severity: **Informational**
- Affected files: backend/app/crud.py, backend/app/database.py
- Evidence:
- ORM-based query construction throughout CRUD.
- Raw SQL usage limited to static health query:
```python
conn.execute(text("SELECT 1"))
```
- Assessment: Current code paths do not concatenate untrusted input into SQL strings.

#### 4.2 Operational database safety concern: silent DB backend fallback
- Severity: **Medium**
- Affected files: backend/app/database.py
- Evidence:
```python
except Exception as e:
    print(f"Warning: Could not connect to PostgreSQL ({e}). Falling back to SQLite.")
    return create_engine(SQLITE_URL, connect_args={"check_same_thread": False})
```
- Attack scenario: Misconfiguration or outage silently redirects writes to local SQLite, causing data divergence and potential integrity/security control bypass.
- Business impact: Inconsistent data, broken compliance/auditability.
- Recommended fix:
```python
except Exception:
    raise RuntimeError("Database connection failed; refusing to start in production")
```

---

## 5. Environment Variables & Secrets Management

### Findings

#### 5.1 Potential secret leakage in .env.example
- Severity: **Critical**
- Affected files: backend/.env.example
- Evidence:
```env
DATABASE_URL=postgresql://...@.../mypsql_clk3
JWT_SECRET=QeyavjsiEdkncQ3Qu89acrEP8CrHcJ3zx3e5cWlojPI=
```
- Attack scenario: If committed/shared, attacker gains DB access and token signing capability.
- Business impact: Full data compromise, account impersonation, regulatory breach.
- Recommended fix:
- Replace with placeholders only:
```env
DATABASE_URL=postgresql://<user>:<password>@<host>/<db>
JWT_SECRET=<generate-strong-random-secret>
```
- Rotate all possibly exposed credentials immediately.

#### 5.2 Sensitive runtime errors printed to stdout
- Severity: **Low**
- Affected files: backend/app/database.py
- Evidence:
```python
print(f"Warning: Could not connect to PostgreSQL ({e}). Falling back to SQLite.")
```
- Risk: Detailed exceptions may expose internal connection details.
- Recommended fix: Structured logger with sanitized messages.

#### 5.3 dotenv loaded in runtime modules (context-dependent)
- Severity: **Informational**
- Affected files: backend/app/auth.py, backend/app/database.py
- Assessment: Acceptable in dev; in production rely on orchestrator environment injection.

---

## 6. Authorization & Resource Ownership Validation

### Findings

#### 6.1 Owner scoping implemented for inventories/categories/items (positive)
- Severity: **Informational**
- Affected files: backend/app/crud.py, backend/app/routers/*.py
- Evidence:
```python
.filter(models.Inventory.id == inv_id, models.Inventory.owner_id == owner_id)
```
and joins through owner filter for items queries.

#### 6.2 Potential ID enumeration signal via deterministic 404 messages
- Severity: **Low**
- Affected files: backend/app/routers/inventories.py, backend/app/routers/items.py
- Evidence:
```python
detail=f"Inventory {inv_id} not found."
```
- Risk: While safe functionally, responses may aid endpoint probing at scale.
- Recommendation: Keep detailed IDs in server logs, return generic public message where appropriate.

#### 6.3 No RBAC/role model
- Severity: **Medium**
- Affected files: backend/app/models.py, backend/app/auth.py, backend/app/routers/*.py
- Impact: No separation for admin/support operations if needed in future.

---

## 7. CORS & HTTP Security Headers

### Findings

#### 7.1 Overly permissive CORS with wildcard origins and credentials
- Severity: **High**
- Affected files: backend/app/main.py
- Evidence:
```python
allow_origins=["*"],
allow_credentials=True,
allow_methods=["*"],
allow_headers=["*"],
```
- Attack scenario: Cross-origin abuse and credentialed requests in unintended contexts.
- Business impact: Increased CSRF-like cross-site interaction risk and data exfiltration surface.
- Recommended fix:
```python
allow_origins=["https://app.example.com"],
allow_credentials=True,
allow_methods=["GET","POST","PUT","DELETE"],
allow_headers=["Authorization","Content-Type"],
```

#### 7.2 Missing HTTP security headers middleware
- Severity: **Medium**
- Affected files: backend/app/main.py
- Missing: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy.
- Recommended fix: add middleware setting strict headers for production.

---

## 8. Exception Handling & Information Leakage

### Findings

#### 8.1 Generic auth validation response is appropriately non-specific (positive)
- Severity: **Informational**
- Affected files: backend/app/auth.py

#### 8.2 Internal exception detail leakage in startup logs
- Severity: **Low**
- Affected files: backend/app/database.py
- Evidence includes raw exception object interpolation in logs.

#### 8.3 No centralized exception normalization layer
- Severity: **Low**
- Affected files: backend/app/main.py
- Risk: inconsistent error responses if future uncaught exceptions occur.

---

## 9. Dependency & Package Security

### Findings

#### 9.1 Unpinned dependencies in requirements.txt
- Severity: **Medium**
- Affected files: backend/requirements.txt
- Evidence:
```txt
fastapi
uvicorn[standard]
sqlalchemy
...
```
- Risk: Supply-chain drift and accidental vulnerable version upgrades.
- Recommended fix:
- Pin exact versions and maintain lockfile (pip-tools/poetry).

#### 9.2 No vulnerability scan evidence in project automation
- Severity: **Medium**
- Affected files: backend/requirements.txt, backend/Dockerfile
- Recommendation: Add CI steps for `pip-audit`/`safety` and container image scans.

#### 9.3 Known-vulnerable package status not deterministically verified in-code review
- Severity: **Informational (Low confidence)**
- Note: This static audit did not include online CVE resolution for resolved versions; run pip-audit in CI/CD.

---

## 10. API Security Best Practices

### Findings

#### 10.1 No rate limiting or brute-force protection
- Severity: **High**
- Affected files: backend/app/routers/auth.py
- Attack scenario: Credential stuffing on `/api/auth/login`.
- Recommended fix:
- Add IP + account-based throttling (e.g., SlowAPI / Redis-backed limiter).

#### 10.2 Input validation constraints are minimal
- Severity: **Medium**
- Affected files: backend/app/schemas.py
- Risk: Large payloads, invalid ranges, and malformed values can degrade reliability/security controls.
- Recommended fix:
- Add bounded field constraints (`min_length`, `max_length`, `ge`, `le`, regex).

#### 10.3 No explicit request size limits
- Severity: **Low**
- Affected files: backend/app/main.py
- Recommendation: enforce max body size at reverse proxy or middleware.

#### 10.4 Swagger/OpenAPI exposed by default in production
- Severity: **High**
- Affected files: backend/app/main.py
- Risk: reconnaissance accelerator for attackers.
- Recommended fix:
```python
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
# or restrict behind admin/auth in production
```

#### 10.5 CSRF posture
- Severity: **Informational**
- Assessment: Bearer token auth in Authorization header (not cookie) reduces classic CSRF risk.

---

## 11. Logging & Monitoring

### Findings

#### 11.1 No structured audit logs for auth-sensitive events
- Severity: **Medium**
- Affected files: backend/app/routers/auth.py, backend/app/auth.py
- Missing: failed login counters, lockout telemetry, token issuance/revocation logging.

#### 11.2 Basic print logging instead of structured logger
- Severity: **Low**
- Affected files: backend/app/database.py
- Recommendation: Replace `print` with structured logger and redaction policy.

#### 11.3 No monitoring/alerting hooks present
- Severity: **Low**
- Affected files: project-wide
- Recommendation: Integrate error tracking + metrics + SIEM shipping.

---

## 12. Severity Classification

| Severity | Count |
|---|---:|
| Critical | 1 |
| High | 4 |
| Medium | 8 |
| Low | 4 |
| Informational | 6 |

CVSS-style rationale:
- Critical/High findings involve credential compromise, token forgery potential, and broad remote attack surface.
- Medium findings primarily increase exploitability or weaken defense-in-depth.
- Low/Informational findings are hardening and operational maturity gaps.

---

## 13. Remediation Plan

### Immediate (0-48h)
1. Rotate DB credentials and JWT secret; scrub .env.example to placeholders.
2. Remove JWT fallback secret and enforce startup failure when secret missing/weak.
3. Lock down CORS to trusted origins and explicit methods/headers.
4. Disable or protect docs/openapi in production.

### Short-term (1-2 sprints)
1. Add auth rate limiting and brute-force protection.
2. Add password policy + optional breach-password checks.
3. Replace silent SQLite fallback with fail-fast production behavior.
4. Add structured logging for auth events and security alerts.

### Long-term (quarter)
1. Introduce refresh token rotation and revocation store.
2. Add RBAC/authorization policy layer if multi-role access is expected.
3. Add dependency lockfile and automated CVE scanning in CI.
4. Add security headers middleware and upstream TLS/HSTS hardening.

---

## 14. Final Verdict

Production readiness assessment: **Not yet production-safe without remediation of critical/high findings**.

Overall risk level: **High**.

Is deployment safe now?
- **No** for internet-facing production in current state.
- **Conditionally acceptable** for controlled dev/test environments.

Top priorities before release:
1. Secret hygiene and credential rotation.
2. CORS hardening.
3. JWT secret enforcement (no fallback).
4. Auth endpoint rate limiting.

---

## Vulnerability Totals

- Total vulnerabilities/findings: **23** (including informational items)
- Count by severity:
  - Critical: **1**
  - High: **4**
  - Medium: **8**
  - Low: **4**
  - Informational: **6**
- Most critical issue discovered:
  - **Potential credential exposure in backend/.env.example (database URL + JWT secret-like value).**

