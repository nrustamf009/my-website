import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PublicBroker } from "@/lib/broker";
import { initials } from "@/lib/format";

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
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: C.ink, lineHeight: 1.35 },
  h1: { fontSize: 20, lineHeight: 1.2, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  h2: { fontSize: 12, lineHeight: 1.2, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  muted: { color: C.muted },
  small: { fontSize: 8, color: C.muted },
  row: { flexDirection: "row" },
  card: { borderWidth: 1, borderColor: C.line, borderRadius: 6, padding: 12 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 5 },
  cellLabel: { flex: 1, color: C.ink2 },
  cellValue: { width: 110, textAlign: "right", fontFamily: "Helvetica-Bold" },
});

/** react-pdf renders PNG/JPEG only; SVG logos fall back to a monogram. */
export function PdfLogo({ logoUrl, name, accent, size = 36 }: { logoUrl: string | null; name: string; accent: string; size?: number }) {
  if (logoUrl && /^data:image\/(png|jpe?g);base64,|^https?:\/\/.+\.(png|jpe?g)(\?|$)/i.test(logoUrl)) {
    return <Image src={logoUrl} style={{ width: size, height: size, objectFit: "contain" }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: 6, backgroundColor: accent, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: size * 0.38 }}>{initials(name)}</Text>
    </View>
  );
}

export function PdfBrandHeader({ broker, title, subtitle }: { broker: PublicBroker; title: string; subtitle?: string }) {
  return (
    <View>
      <View style={{ height: 5, backgroundColor: broker.accentColor, marginHorizontal: -36, marginTop: -36, marginBottom: 22 }} />
      <View style={[s.row, { alignItems: "center", justifyContent: "space-between", marginBottom: 18 }]}>
        <View style={[s.row, { alignItems: "center" }]}>
          <PdfLogo logoUrl={broker.logoUrl} name={broker.companyName} accent={broker.accentColor} />
          <View style={{ marginLeft: 10 }}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 12, lineHeight: 1.2 }}>{broker.companyName}</Text>
            <Text style={s.small}>{broker.name}, {broker.title} · NMLS #{broker.nmlsId}</Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          {broker.phone ? <Text style={{ fontSize: 9 }}>{broker.phone}</Text> : null}
          <Text style={{ fontSize: 9 }}>{broker.email}</Text>
        </View>
      </View>
      <Text style={s.h1}>{title}</Text>
      {subtitle ? <Text style={[s.muted, { marginBottom: 14 }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function PdfFooter({ broker, extra }: { broker: PublicBroker; extra?: string }) {
  return (
    <View fixed style={{ position: "absolute", left: 36, right: 36, bottom: 24, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6 }}>
      <Text style={[s.small, { fontSize: 7 }]}>
        {broker.name}, NMLS #{broker.nmlsId}
        {broker.companyNmlsId ? ` · ${broker.companyName}, NMLS #${broker.companyNmlsId}` : ` · ${broker.companyName}`}
        {broker.licensedStates ? ` · Licensed in ${broker.licensedStates}` : ""}. {extra ?? ""} {broker.disclaimerText}
      </Text>
    </View>
  );
}

export function Kv({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={s.tableRow}>
      <Text style={s.cellLabel}>{label}</Text>
      <Text style={[s.cellValue, strong ? { fontSize: 11 } : {}]}>{value}</Text>
    </View>
  );
}
