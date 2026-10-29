# Registration and account access

Open Admin → Accounts & access (`/admin/users`), also available under Settings → User management.

Registration is controlled by the existing switch. New users appear automatically as active ordinary accounts with existing feature defaults and no expiry; existing accounts keep their settings. Administrators may set role, activation, AI permission, import/export permission and an expiry timestamp, or remove the time limit. Administrators have full feature permissions.

Expiry is entered in the operator device time zone and stored as an absolute timestamp; lists use the application time zone. Shortcuts extend by 1, 7 or 30 days from an upcoming deadline, or from now when already expired. At the deadline, ordinary accounts cannot log in, access protected pages or call APIs, including with existing sessions. Extending access restores use without deleting learning data. Already open pages display an expiry notice; in-flight operations are not forcibly interrupted.

The current and primary administrator are protected. The last active administrator cannot be demoted, disabled or deleted. Request checks use current database state rather than cached JWT permissions and fail closed if verification is unavailable. Openclaw credential and API-key modes check the final target account and AI permission as well.

Exports include access metadata. Imports deliberately do not restore access rights or roles, preventing self-renewal from an old backup. An administrator may reapply those settings through the account panel after restoring learning data. The web app and online Android client use the same rules; APK reinstallation is unnecessary.
