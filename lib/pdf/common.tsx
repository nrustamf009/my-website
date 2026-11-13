import path from "node:path";
import { Font, Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PublicBrand } from "@/lib/broker";
import { initials } from "@/lib/format";
import { t } from "@/lib/strings/en";

const dir = path.join(process.cwd(), "lib", "pdf", "fonts");
let registered = false;
export function registerFonts() {
  if (registered) return;
  Font.register({
    family: "Inter",
    fonts: [
      { src: path.join(dir, "inter-latin-400-normal.woff"), fontWeight: 400 },
      { src: path.join(dir, "inter-latin-600-normal.woff"), fontWeight: 600 },
      { src: path.join(dir, "inter-latin-700-normal.woff"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: "Fraunces",
    fonts: [
      { src: path.join(dir, "fraunces-latin-400-normal.woff"), fontWeight: 400 },
      { src: path.join(dir, "fraunces-latin-600-normal.woff"), fontWeight: 600 },
    ],
  });
  Font.registerHyphenationCallback((w) => [w]);
  registered = true;
}

export const C = {
  ink: "#17150f",
  ink2: "#3d3a33",
  muted: "#6f6a60",
  line: "#e6e2d9",
  paper: "#faf8f3",
  good: "#157a4a",
  goodSoft: "#e3f3ea",
  warn: "#a15c07",
  warnSoft: "#fbefd9",
  bad: "#b42318",
  badSoft: "#fde8e6",
};

export const s = StyleSheet.create({
  page: { padding: 36, paddingBottom: 92, fontSize: 9.5, fontFamily: "Inter", color: C.ink, lineHeight: 1.35 },
  display: { fontFamily: "Fraunces", fontSize: 22, lineHeight: 1.15 },
  h2: { fontSize: 11, fontWeight: 600, marginBottom: 6, lineHeight: 1.2 },
  muted: { color: C.muted },
  small: { fontSize: 7.5, color: C.muted, lineHeight: 1.35 },
  row: { flexDirection: "row" },
  card: { borderWidth: 1, borderColor: C.line, borderRadius: 6, padding: 12 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 4.5 },
  cellLabel: { flex: 1, color: C.ink2 },
  cellValue: { width: 120, textAlign: "right", fontWeight: 600 },
  eyebrow: { fontSize: 7.5, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase" },
});

/** react-pdf renders PNG/JPEG only; SVG logos fall back to a monogram. */
export function PdfLogo({ url, name, accent, size = 34, round = false }: { url: string | null; name: string; accent: string; size?: number; round?: boolean }) {
  if (url && /^data:image\/(png|jpe?g);base64,|^https?:\/\/.+\.(png|jpe?g)(\?|$)/i.test(url)) {
    return <Image src={url} style={{ width: size, height: size, objectFit: round ? "cover" : "contain", borderRadius: round ? size : 4 }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: round ? size : 6, backgroundColor: accent, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#ffffff", fontWeight: 700, fontSize: size * 0.36 }}>{initials(name)}</Text>
    </View>
  );
}

export function PdfHeader({ brand, eyebrow, title, subtitle }: { brand: PublicBrand; eyebrow: string; title: string; subtitle?: string }) {
  return (
    <View>
      <View style={{ height: 5, backgroundColor: brand.accentColor, marginHorizontal: -36, marginTop: -36, marginBottom: 20 }} />
      <View style={[s.row, { alignItems: "center", justifyContent: "space-between", marginBottom: 16 }]}>
        <View style={[s.row, { alignItems: "center" }]}>
          <PdfLogo url={brand.logoUrl} name={brand.companyName} accent={brand.accentColor} />
          <View style={{ marginLeft: 9 }}>
            <Text style={{ fontWeight: 700, fontSize: 11 }}>{brand.companyName}</Text>
            <Text style={s.small}>Company NMLS #{brand.companyNmlsId}</Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontWeight: 600 }}>{brand.lo.name}</Text>
          <Text style={s.small}>{brand.lo.nmlsId ? `NMLS #${brand.lo.nmlsId} · ` : ""}{brand.lo.phone ?? brand.lo.email}</Text>
        </View>
      </View>
      <Text style={[s.eyebrow, { color: brand.accentText }]}>{eyebrow}</Text>
      <Text style={[s.display, { marginTop: 3 }]}>{title}</Text>
      {subtitle ? <Text style={[s.muted, { marginTop: 3, marginBottom: 12 }]}>{subtitle}</Text> : null}
    </View>
  );
}

/** PDF mirror of <BrokerFooter/>: LO + company NMLS, EHO, licensed states, versioned disclaimer. */
export function PdfFooter({ brand, extra }: { brand: PublicBrand; extra?: string }) {
  return (
    <View fixed style={{ position: "absolute", left: 36, right: 36, bottom: 22, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6 }}>
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
  return (
    <View style={s.tableRow}>
      <Text style={s.cellLabel}>{label}</Text>
      <Text style={[s.cellValue, strong ? { fontSize: 10.5 } : {}]}>{value}</Text>
    </View>
  );
}
