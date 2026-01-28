
## How refreshCredentialsFn Returns Boolean
┌─────────────────────────────────────────────────────────────────────────┐
│ SHARED WORKER                           │ MAIN THREAD                   │
├─────────────────────────────────────────┼───────────────────────────────┤
│                                         │                               │
│ 1. await refreshCredentialsFn()         │                               │
│    ↓                                    │                               │
│ 2. new Promise((resolve) => {           │                               │
│      tokenRefreshResolver = resolve; ←──┼── Stores resolve function     │
│      postMessage(REQUEST_TOKEN_REFRESH) │                               │
│    })                                   │                               │
│    ↓                                    │                               │
│ 3. Waiting... (Promise pending)    ────→│ 4. Receives REQUEST_TOKEN_REFRESH
│                                         │    ↓                          │
│                                         │ 5. await postCogInit()        │
│                                         │    ↓                          │
│                                         │ 6. postMessage(TOKEN_REFRESH_SUCCESS,
│                                         │      { credentials })         │
│    ↓                                    │                               │
│ 7. Receives TOKEN_REFRESH_SUCCESS       │                               │
│    ↓                                    │                               │
│ 8. configureAWS(credentials)            │                               │
│    ↓                                    │                               │
│ 9. tokenRefreshResolver(true) ──────────┼── Resolves the Promise!       │
│    ↓                                    │                               │
│ 10. refreshCredentialsFn() returns true │                               │
└─────────────────────────────────────────┴───────────────────────────────┘

The key is tokenRefreshResolver - it's a reference to the Promise's resolve function. When main thread responds, worker calls tokenRefreshResolver(true) which resolves the Promise with true.


## Audio upload flow 

uploadFileToS3() / uploadFileToS3Worker()
    ↓
No credentials? → Fetch from API (with retry)
    ↓
Upload to S3
    ↓
Error? → Permanent (401/403/404)? → Fail
    ↓
Transient → Refresh credentials → Retry (3x with backoff)


## Proposed Solution

┌─────────────────────────────────────────────────────────────┐
│                    S3UploadService                          │
├─────────────────────────────────────────────────────────────┤
│  uploadWithCredentialManagement({                           │
│    file, fileName, txnID, businessID,                       │
│    maxRetries: 3                                            │
│  })                                                         │
│                                                             │
│  Internal flow (all retried as one unit):                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. Check if credentials exist & valid               │   │
│  │ 2. If not → fetchAndConfigureCredentials()          │   │
│  │ 3. Upload file to S3                                │   │
│  │ 4. If auth error → refresh credentials & retry      │   │
│  │ 5. If network error → retry with backoff            │   │
│  │ 6. If permanent error → fail                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Returns: { success, error, canRetry }                      │
└─────────────────────────────────────────────────────────────┘


## Permanent Errors (Don't Retry)

Error	Why Permanent
is_session_expired: true from token API	User's main app session expired - need to re-login
401 from main API (not S3)	Auth token invalid - user needs to re-authenticate
403 Forbidden from S3	No permission to upload - retrying won't help
404 Bucket not found	Bucket doesn't exist - config issue


## Transient Errors (Should Retry)

Error	Why Transient
Network timeout/DNS failure	Temporary network issue
5xx errors (500, 502, 503, 504)	Server temporarily unavailable
AWS ExpiredToken / CredentialsError	Just need new credentials
429 Rate limit	Wait and retry
In Code

# Permanent - stop immediately
if (is_session_expired) return { error: 'SESSION_EXPIRED', canRetry: false };
if (statusCode === 401) return { error: 'AUTH_EXPIRED', canRetry: false };
if (statusCode === 403) return { error: 'FORBIDDEN', canRetry: false };
if (statusCode === 404) return { error: 'NOT_FOUND', canRetry: false };

# Transient - refresh credentials and retry
// Everything else: network errors, 5xx, credential errors


# Note 
If a function is invoked from a worker thread, worker has its own JS context so it will keep track of the variables, methods used in that function in that worker thread