import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SiteWiseTools — Smart Product Intelligence Across 11 Verticals",
  description: "Data-driven product assessments, expert buying guides, and specification analysis across 11 industry categories.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
