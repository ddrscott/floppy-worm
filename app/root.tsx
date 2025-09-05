import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import type { LinksFunction } from "@remix-run/node";

import "./tailwind.css";

export const links: LinksFunction = () => [
  // PWA manifest for installability
  { rel: "manifest", href: "/manifest.json" },
  // Favicon
  { rel: "icon", type: "image/x-icon", href: "/icons/favicon.ico" },
  { rel: "icon", type: "image/svg+xml", href: "/icons/favicon.svg" },
  { rel: "icon", type: "image/png", sizes: "96x96", href: "/icons/favicon-96x96.png" },
  // Apple touch icon
  { rel: "apple-touch-icon", sizes: "180x180", href: "/icons/apple-touch-icon.png" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#232333" />
        <meta name="description" content="A physics-based worm game with challenging levels" />
        <Meta />
        <Links />
        <script defer data-domain="fw.ljs.app" src="https://plausible.ljs.app/js/script.outbound-links.pageview-props.tagged-events.js" />
        <style dangerouslySetInnerHTML={{
          __html: `
            body {
              margin: 0;
              padding: 0;
              background-color: #333333;
            }
            
            #game-container {
              width: 100vw;
              height: 100vh;
            }
          `
        }} />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
        <script src="/register-sw.js" defer />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
