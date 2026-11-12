"use client";

import ErrorView from "./error-view";

export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return <main className="p-4"><ErrorView error={error} retry={retry} home="/" /></main>;
}
