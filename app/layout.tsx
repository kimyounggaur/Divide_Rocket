import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";

import "./globals.css";

const baseMetadata: Metadata = {
  title: {
    default: "분할 로켓 | 멜로디아 리듬 실험실",
    template: "%s | 분할 로켓",
  },
  description:
    "한 박을 1·2·3·4개로 고르게 나누며 8분음표, 셋잇단음표, 16분음표를 배우는 모바일 리듬 게임입니다.",
  applicationName: "분할 로켓",
  category: "education",
  keywords: ["음악이론", "리듬게임", "셋잇단음표", "16분음표", "분할 로켓"],
};

export async function generateMetadata(): Promise<Metadata> {
  const incomingHeaders = await headers();
  const forwardedHost = incomingHeaders.get("x-forwarded-host");
  const host = (forwardedHost ?? incomingHeaders.get("host") ?? "localhost:3000")
    .split(",")[0]
    .trim();
  const forwardedProtocol = incomingHeaders.get("x-forwarded-proto")?.split(",")[0].trim();
  const protocol = forwardedProtocol ?? (host.startsWith("localhost") ? "http" : "https");
  let origin: URL;
  try {
    origin = new URL(`${protocol}://${host}`);
  } catch {
    origin = new URL("http://localhost:3000");
  }
  const socialImage = new URL("/og.png", origin).toString();

  return {
    ...baseMetadata,
    metadataBase: origin,
    openGraph: {
      type: "website",
      locale: "ko_KR",
      title: "분할 로켓 | 멜로디아 리듬 실험실",
      description: "한 박을 고르게 나누고, 별빛을 채워 발사!",
      siteName: "분할 로켓",
      images: [
        {
          url: socialImage,
          width: 1733,
          height: 908,
          alt: "종이 공예 별빛 극장에서 발사하는 분할 로켓",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "분할 로켓 | 멜로디아 리듬 실험실",
      description: "한 박을 고르게 나누고, 별빛을 채워 발사!",
      images: [socialImage],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1b2c43",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
