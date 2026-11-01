# Public entry, private workspace

Status: Accepted

The owner requested a public Site and proposed Google SSO. The anonymous surface
is limited to the entry page and the framework's compiled assets. The Worker
must run before static assets. All other paths, including restored attachments,
SSR documents, API routes and MCP, require the existing verified Site owner.
Private responses are non-cacheable. Changing the Sites audience alone is not
sufficient to protect the imported backup.

Google SSO is not enabled by this change. The available Sites integration uses
ChatGPT identity. A direct Google login requires a separately configured Google
application and a confirmed compatible integration. Do not label the existing
ChatGPT sign-in as Google SSO. Multiuser membership remains a separate step.
