import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "聚餐分账",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="shell">{children}</div>
      </body>
    </html>
  );
}
