export function FeedbackBanner({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  if (!error && !success) {
    return null;
  }

  return (
    <div
      className={
        error
          ? "rounded-md border border-danger/40 bg-danger/15 p-3 text-sm font-semibold text-danger"
          : "rounded-md border border-success/40 bg-success/15 p-3 text-sm font-semibold text-success"
      }
    >
      {error ?? success}
    </div>
  );
}
