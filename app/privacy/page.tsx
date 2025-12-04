export default function PrivacyPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Privacy & Security
      </h1>
      <p className="text-sm text-muted-foreground">
        Z-Ray is designed so that your viewing key and decrypted transaction
        data never leave your browser.
      </p>
      <p className="text-xs text-muted-foreground">
        This page will document the trust model, what is stored locally, and
        best practices for using Z-Ray on shared devices.
      </p>
    </div>
  );
}
