import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { Font, Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PublicBrand } from "@/lib/broker";
import { initials } from "@/lib/format";
import { t } from "@/lib/strings/en";
import { getPdfTheme, type PdfTheme } from "./theme";

const dir = path.join(process.cwd(), "src", "design", "fonts");
let registered = false;

/** Registers every theme family once (TTF from src/design/fonts) and disables hyphenation so numbers never break. */
export function registerPdfFonts() {
  if (registered) return;
  const f = (file: string) => path.join(dir, `${file}.ttf`);
  Font.register({ family: "InstrumentSerif", fonts: [{ src: f("instrument-serif-400"), fontWeight: 400 }, { src: f("instrument-serif-400-italic"), fontWeight: 400, fontStyle: "italic" }] });
  Font.register({ family: "HankenGrotesk", fonts: [400, 500, 600].map((w) => ({ src: f(`hanken-grotesk-${w}`), fontWeight: w })) });
  Font.register({ family: "PlexSans", fonts: [400, 500, 600].map((w) => ({ src: f(`ibm-plex-sans-${w}`), fontWeight: w })) });
  Font.register({ family: "InterTight", fonts: [400, 500, 600, 700].map((w) => ({ src: f(`inter-tight-${w}`), fontWeight: w })) });
  Font.registerHyphenationCallback((w) => [w]);
  registered = true;
}

function makeKit(pt: PdfTheme) {
  const k = pt.color;
  // Legacy color names used by the PDF documents.
  const C = { ink: k.ink, ink2: k.ink2, muted: k.muted, line: k.rule, paper: k.panel, white: k.paper, good: k.positive, goodSoft: k.positiveTint, warn: k.warn, warnSoft: k.warnTint, bad: k.negative, badSoft: k.negativeTint, accent: k.accent, accentText: k.accentText, onAccent: k.onAccent, accentTint: k.accentTint, band: k.band, onBand: k.onBand, display: pt.font.display, body: pt.font.body, mono: pt.font.mono };
  const s = StyleSheet.create({
    page: { padding: 36, paddingBottom: 96, fontSize: 9.5, fontFamily: pt.font.body, color: k.ink, lineHeight: 1.35, backgroundColor: k.paper },
    display: { fontFamily: pt.font.display, fontSize: 22, lineHeight: 1.15, fontWeight: pt.displayWeight },
    numeral: { fontFamily: pt.font.display, fontWeight: pt.displayWeight },
    h2: { fontSize: 11, fontWeight: 600, marginBottom: 6, lineHeight: 1.2 },
    muted: { color: k.muted },
    small: { fontSize: 9, color: k.muted, lineHeight: 1.35 },
    row: { flexDirection: "row" },
    card: { borderWidth: pt.rule.hairline, borderColor: k.rule, borderRadius: pt.radius.card, padding: 12 },
    tableRow: { flexDirection: "row", borderBottomWidth: pt.rule.hairline, borderBottomColor: k.rule, paddingVertical: 4.5 },
    cellLabel: { flex: 1, color: k.ink2 },
    cellValue: { width: 120, textAlign: "right", fontWeight: 600 },
    eyebrow: { fontSize: 7.5, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase" },
  });
  return { pt, C, s };
}

type Kit = ReturnType<typeof makeKit>;
const store = new AsyncLocalStorage<Kit>();
const cache = new Map<string, Kit>();

/**
 * Render a PDF with the broker's theme. The theme travels in AsyncLocalStorage (React context is not
 * available to server-side code in the app router), so concurrent renders never mix themes.
 */
export function withPdfTheme<T>(theme: unknown, accent: string | null | undefined, render: () => Promise<T>): Promise<T> {
  const key = `${String(theme)}|${accent ?? ""}`;
  let kit = cache.get(key);
  if (!kit) {
    kit = makeKit(getPdfTheme(theme, accent));
    cache.set(key, kit);
  }
  registerPdfFonts();
  return store.run(kit, render);
}

/** Theme colors (C), styles (s) and the raw PDF theme (pt) for the current document. */
export function usePdf(): Kit {
  const k = store.getStore();
  if (!k) throw new Error("usePdf() must be called while rendering inside withPdfTheme()");
  return k;
}

/** react-pdf renders PNG/JPEG only; SVG logos fall back to a monogram. */
export function PdfLogo({ url, name, size = 34, round = false }: { url: string | null; name: string; accent?: string; size?: number; round?: boolean }) {
  const { C, pt } = usePdf();
  if (url && /^data:image\/(png|jpe?g);base64,|^https?:\/\/.+\.(png|jpe?g)(\?|$)/i.test(url)) {
    return <Image src={url} style={{ width: size, height: size, objectFit: round ? "cover" : "contain", borderRadius: round ? size : pt.radius.control }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: round ? size : pt.radius.control, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: C.onAccent, fontWeight: 600, fontSize: size * 0.36 }}>{initials(name)}</Text>
    </View>
  );
}

/** Header: terminal prints a dark band with the company in white; maison and atelier a thin accent rule. */
export function PdfHeader({ brand, eyebrow, title, subtitle }: { brand: PublicBrand; eyebrow: string; title: string; subtitle?: string }) {
  const { C, s, pt } = usePdf();
  const band = pt.flags.headerBand;
  return (
    <View>
      {band ? (
        <View style={[s.row, { backgroundColor: C.band, marginHorizontal: -36, marginTop: -36, marginBottom: 18, paddingHorizontal: 36, paddingVertical: 14, alignItems: "center", justifyContent: "space-between" }]}>
          <View style={[s.row, { alignItems: "center" }]}>
            <PdfLogo url={brand.logoUrl} name={brand.companyName} size={28} />
            <View style={{ marginLeft: 9 }}>
              <Text style={{ fontWeight: 600, fontSize: 11, color: C.onBand }}>{brand.companyName}</Text>
              <Text style={{ fontSize: 8, color: C.onBand }}>Company NMLS #{brand.companyNmlsId}</Text>
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontWeight: 600, color: C.onBand }}>{brand.lo.name}</Text>
            <Text style={{ fontSize: 8, color: C.onBand }}>{brand.lo.nmlsId ? `NMLS #${brand.lo.nmlsId} · ` : ""}{brand.lo.phone ?? brand.lo.email}</Text>
          </View>
        </View>
      ) : (
        <>
          <View style={{ height: 5, backgroundColor: C.accent, marginHorizontal: -36, marginTop: -36, marginBottom: 20 }} />
          <View style={[s.row, { alignItems: "center", justifyContent: "space-between", marginBottom: 16 }]}>
            <View style={[s.row, { alignItems: "center" }]}>
              <PdfLogo url={brand.logoUrl} name={brand.companyName} />
              <View style={{ marginLeft: 9 }}>
                <Text style={{ fontWeight: 600, fontSize: 11 }}>{brand.companyName}</Text>
                <Text style={s.small}>Company NMLS #{brand.companyNmlsId}</Text>
              </View>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontWeight: 600 }}>{brand.lo.name}</Text>
              <Text style={s.small}>{brand.lo.nmlsId ? `NMLS #${brand.lo.nmlsId} · ` : ""}{brand.lo.phone ?? brand.lo.email}</Text>
            </View>
          </View>
        </>
      )}
      <Text style={[s.eyebrow, { color: C.accentText }]}>{eyebrow}</Text>
      <Text style={[s.display, { marginTop: 3, fontStyle: "normal" }]}>{title}</Text>
      {subtitle ? <Text style={[s.muted, { marginTop: 3, marginBottom: 12 }]}>{subtitle}</Text> : null}
    </View>
  );
}

/** PDF mirror of <BrokerFooter/>: LO + company NMLS, licensed states, versioned disclaimer, NMLS Consumer Access, EHO. Disclaimer ≥ 9pt. */
export function PdfFooter({ brand, extra }: { brand: PublicBrand; extra?: string }) {
  const { C, s } = usePdf();
  return (
    <View fixed style={{ position: "absolute", left: 36, right: 36, bottom: 18, borderTopWidth: 0.75, borderTopColor: C.line, paddingTop: 6 }}>
      <Text style={[s.small, { color: C.ink2 }]}>
        {brand.lo.name}{brand.lo.nmlsId ? `, NMLS #${brand.lo.nmlsId}` : ""} · {brand.companyName}, Company NMLS #{brand.companyNmlsId}
        {brand.licensedStates.length ? ` · ${t.footer.licensedIn(brand.licensedStates.join(", "))}` : ""} · {t.footer.eho} · nmlsconsumeraccess.org
      </Text>
      <Text style={[s.small, { marginTop: 2 }]}>
        {extra ? `${extra} ` : ""}{brand.disclaimer.text} ({t.footer.disclaimerVersion(brand.disclaimer.version)})
      </Text>
    </View>
  );
}

export function Kv({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const { s } = usePdf();
  return (
    <View style={s.tableRow}>
      <Text style={s.cellLabel}>{label}</Text>
      <Text style={[s.cellValue, strong ? { fontSize: 10.5 } : {}]}>{value}</Text>
    </View>
  );
}
