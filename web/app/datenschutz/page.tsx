import type { Metadata } from "next";
export const metadata: Metadata = { title: "Privacy & local storage" };
export default function Privacy() {
  return <article className="prose-copy mx-auto max-w-3xl rounded-3xl bg-card p-6 sm:p-10">
    <h1 className="text-3xl font-semibold tracking-tight">Your data in the portfolio</h1>
    <p>Portfolio transactions, your watchlist and your settings are stored in this browser. No account is needed. Broker files are read in the browser. There is no backup unless you export one: clearing your browser data can delete your portfolio and watchlist.</p>
    <h2>Which requests leave the browser</h2>
    <p>For price histories, current prices and identifying securities, the app sends tickers or ISINs to its API, which may ask Yahoo Finance. To compare with public filings, security identifiers are passed to the Outsider database query. Share counts, purchase costs and the full broker file are never sent.</p>
    <p>When the website loads, the hosting provider receives the connection data it technically needs, such as the IP address and the requested URL. Company logos or portraits loaded from elsewhere can also send a request to that image provider.</p>
    <h2>Saving and backing up</h2>
    <p>Local storage holds your portfolio, watchlist and settings. You can export your portfolio in Settings and import it in the portfolio view. The app tells you when saving in the browser fails. Check your backups before clearing browser data.</p>
    <h2>Transparency note on the project’s status</h2>
    <p>This page describes how data flows through the app. Details on the responsible operator, contact and the hosting contracts actually in use are still to be added. Until then it is not a complete privacy policy.</p>
  </article>;
}
