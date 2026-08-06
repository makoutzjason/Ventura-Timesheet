import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  SHORT_HOURS_REASON_LABELS,
  GUARANTEED_HOURS_REASON_LABELS,
  calculateRegularHours,
  calculateOnCallHours,
  calculateCallBackHours,
} from "@/lib/timesheets";

// Read into a buffer rather than handing react-pdf a path string — its
// path-vs-URL sniffing is unreliable with Windows-style paths, and a buffer
// is unambiguous regardless of platform.
const LOGO_BUFFER = readFileSync(path.join(process.cwd(), "src/lib/pdf/assets/ventura-logo.png"));

const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THUR", "FRI", "SAT"];

export type TimesheetPdfEntry = {
  workDate: string; // "YYYY-MM-DD"
  timeIn: string | null;
  timeOut: string | null;
  lunchOut: string | null;
  lunchIn: string | null;
  noLunch: boolean;
  shortHoursReason: string | null;
  comments: string | null;
  onCallTimeIn: string | null;
  onCallTimeOut: string | null;
  callBackTimeIn: string | null;
  callBackTimeOut: string | null;
  callBackReason: string | null;
  mileage: number | null;
};

export type TimesheetPdfData = {
  travelerName: string;
  facilityName: string;
  recruiterName: string | null;
  weekStartDate: string;
  weekEndDate: string;
  guaranteedHours: number | null;
  guaranteedHoursReason: string | null;
  guaranteedHoursNote: string | null;
  entries: TimesheetPdfEntry[];
  employeeSignature: { name: string; timestamp: string } | null;
  facilitySignature: { name: string; timestamp: string } | null;
};

// "YYYY-MM-DD" -> "MM/DD/YY", "HH:MM" -> "h:mm AM/PM" — the paper form's own
// conventions, not ISO/24-hour.
function formatDateShort(value: string) {
  const [year, month, day] = value.split("-");
  return `${month}/${day}/${year.slice(2)}`;
}

function formatTime12h(value: string | null) {
  if (!value) return "";
  const [hoursStr, minutes] = value.split(":");
  const hours = Number(hoursStr);
  const period = hours >= 12 ? "PM" : "AM";
  const twelveHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelveHour}:${minutes} ${period}`;
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return `${date.toLocaleDateString("en-US")} ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

function dayLabel(workDate: string) {
  const [year, month, day] = workDate.split("-").map(Number);
  return DAY_LABELS[new Date(year, month - 1, day).getDay()];
}

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 8, fontFamily: "Helvetica", color: "#111827" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 8, fontFamily: "Helvetica-Oblique", marginTop: 2 },
  logo: { width: 110, height: 28, marginBottom: 4, alignSelf: "flex-end" },
  instructionsTitle: { fontSize: 7, fontFamily: "Helvetica-Bold", textDecoration: "underline", textAlign: "right" },
  instructionsItem: { fontSize: 6.5, marginTop: 1, textAlign: "right" },

  infoBox: { border: "1pt solid #333", marginBottom: 8 },
  infoRow: { flexDirection: "row", borderBottom: "0.5pt solid #999" },
  infoLabel: { width: 110, padding: 3, fontSize: 7, fontFamily: "Helvetica-Bold", backgroundColor: "#eef2f6" },
  infoValue: { flex: 1, padding: 3, fontSize: 7 },

  sectionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 3 },

  table: { border: "1pt solid #333" },
  tr: { flexDirection: "row", borderBottom: "0.5pt solid #999" },
  th: { fontSize: 6, fontFamily: "Helvetica-Bold", padding: 2, backgroundColor: "#eef2f6", borderRight: "0.5pt solid #999", textAlign: "center" },
  td: { fontSize: 6.5, padding: 2, borderRight: "0.5pt solid #999", textAlign: "center" },
  tdLeft: { fontSize: 6.5, padding: 2, borderRight: "0.5pt solid #999", textAlign: "left" },

  totalsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  totalsNote: { flex: 1, fontSize: 7, marginRight: 8 },
  totalsBox: { border: "1pt solid #333", padding: 4, backgroundColor: "#fff8d6" },
  totalsLabel: { fontSize: 7, fontFamily: "Helvetica-Bold" },
  totalsValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },

  callSectionRow: { flexDirection: "row", gap: 6, marginTop: 4 },
  callTableCol: { flex: 1 },

  signatureRow: { flexDirection: "row", gap: 16, marginTop: 14 },
  signatureCol: { flex: 1 },
  signatureLine: { fontSize: 7.5, marginBottom: 2 },
  signatureValue: { fontFamily: "Helvetica-Bold" },
  certText: { fontSize: 6, color: "#444", marginTop: 4 },
});

// Regular-hours column widths (percent of table width), left to right:
// DAY, DATE, TIME-IN, LUNCH-OUT, LUNCH-IN, TIME-OUT, TOTAL, REASON, COMMENTS
const REGULAR_COLS = [7, 9, 10, 10, 10, 10, 8, 14, 22];

export function TimesheetPdf({ data }: { data: TimesheetPdfData }) {
  const weekStartLabel = dayLabel(data.weekStartDate);

  const totalRegularHours = data.entries.reduce(
    (sum, e) => sum + (calculateRegularHours(e.timeIn ?? "", e.timeOut ?? "", e.lunchOut ?? "", e.lunchIn ?? "", e.noLunch) ?? 0),
    0,
  );
  const totalOnCallHours = data.entries.reduce(
    (sum, e) => sum + (calculateOnCallHours(e.onCallTimeIn ?? "", e.onCallTimeOut ?? "") ?? 0),
    0,
  );
  const totalCallBackHours = data.entries.reduce(
    (sum, e) => sum + (calculateCallBackHours(e.callBackTimeIn ?? "", e.callBackTimeOut ?? "") ?? 0),
    0,
  );
  const totalMileage = data.entries.reduce((sum, e) => sum + (e.mileage ?? 0), 0);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>TIMESHEET — DUE {weekStartLabel} BY NOON CST</Text>
            <Text style={styles.subtitle}>Email to your recruiter!</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Image src={LOGO_BUFFER} style={styles.logo} />
            <Text style={styles.instructionsTitle}>INSTRUCTIONS/GUIDELINES:</Text>
            <Text style={styles.instructionsItem}>1. List ALL in/out times and lunch minutes, not just total hours.</Text>
            <Text style={styles.instructionsItem}>2. Please note exceptions in comments.</Text>
            <Text style={styles.instructionsItem}>3. Time is calculated by in/out times. Do not round.</Text>
            <Text style={styles.instructionsItem}>4. Undocumented lunch breaks deducted @ 1/2 hour/day unless noted (no lunch).</Text>
            <Text style={styles.instructionsItem}>5. Timesheets need to be signed by employee AND an authorized manager to be paid.</Text>
            <Text style={styles.instructionsItem}>6. Explain any time missed.</Text>
          </View>
        </View>

        <View style={styles.infoBox}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>EMPLOYEE NAME</Text>
            <Text style={styles.infoValue}>{data.travelerName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>FACILITY NAME</Text>
            <Text style={styles.infoValue}>{data.facilityName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>RECRUITER NAME</Text>
            <Text style={styles.infoValue}>{data.recruiterName ?? ""}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottom: undefined }]}>
            <Text style={styles.infoLabel}>WEEK OF</Text>
            <Text style={styles.infoValue}>
              {formatDateShort(data.weekStartDate)} – {formatDateShort(data.weekEndDate)}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>REGULAR HOURS — Please complete ALL in/out times and TOTAL.</Text>
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.th, { width: `${REGULAR_COLS[0]}%` }]}>DAY</Text>
            <Text style={[styles.th, { width: `${REGULAR_COLS[1]}%` }]}>DATE</Text>
            <Text style={[styles.th, { width: `${REGULAR_COLS[2]}%` }]}>TIME-IN</Text>
            <Text style={[styles.th, { width: `${REGULAR_COLS[3]}%` }]}>LUNCH-OUT</Text>
            <Text style={[styles.th, { width: `${REGULAR_COLS[4]}%` }]}>LUNCH-IN</Text>
            <Text style={[styles.th, { width: `${REGULAR_COLS[5]}%` }]}>TIME-OUT</Text>
            <Text style={[styles.th, { width: `${REGULAR_COLS[6]}%` }]}>TOTAL{"\n"}HOURS</Text>
            <Text style={[styles.th, { width: `${REGULAR_COLS[7]}%`, borderRight: undefined }]}>REASON FOR{"\n"}SHORT HOURS</Text>
            <Text style={[styles.th, { width: `${REGULAR_COLS[8]}%`, borderRight: undefined }]}>COMMENTS</Text>
          </View>
          {data.entries.map((entry) => {
            const hours = calculateRegularHours(entry.timeIn ?? "", entry.timeOut ?? "", entry.lunchOut ?? "", entry.lunchIn ?? "", entry.noLunch);
            const lunchText = entry.noLunch
              ? "No lunch"
              : entry.lunchOut && entry.lunchIn
                ? `${formatTime12h(entry.lunchOut)} / ${formatTime12h(entry.lunchIn)}`
                : "";
            return (
              <View style={styles.tr} key={entry.workDate}>
                <Text style={[styles.td, { width: `${REGULAR_COLS[0]}%` }]}>{dayLabel(entry.workDate)}</Text>
                <Text style={[styles.td, { width: `${REGULAR_COLS[1]}%` }]}>{formatDateShort(entry.workDate)}</Text>
                <Text style={[styles.td, { width: `${REGULAR_COLS[2]}%` }]}>{formatTime12h(entry.timeIn)}</Text>
                <Text style={[styles.td, { width: `${REGULAR_COLS[3] + REGULAR_COLS[4]}%` }]}>{lunchText}</Text>
                <Text style={[styles.td, { width: `${REGULAR_COLS[5]}%` }]}>{formatTime12h(entry.timeOut)}</Text>
                <Text style={[styles.td, { width: `${REGULAR_COLS[6]}%` }]}>{hours !== null ? hours.toFixed(2) : ""}</Text>
                <Text style={[styles.tdLeft, { width: `${REGULAR_COLS[7]}%` }]}>
                  {entry.shortHoursReason ? SHORT_HOURS_REASON_LABELS[entry.shortHoursReason] ?? entry.shortHoursReason : ""}
                </Text>
                <Text style={[styles.tdLeft, { width: `${REGULAR_COLS[8]}%`, borderRight: undefined }]}>{entry.comments ?? ""}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.totalsRow}>
          <Text style={styles.totalsNote}>
            {data.guaranteedHours !== null
              ? `Guaranteed hours: ${data.guaranteedHours} · Worked (incl. call-back): ${(totalRegularHours + totalCallBackHours).toFixed(2)} · Reason: ${
                  data.guaranteedHoursReason
                    ? GUARANTEED_HOURS_REASON_LABELS[data.guaranteedHoursReason] ?? data.guaranteedHoursReason
                    : "—"
                }${data.guaranteedHoursNote ? ` · ${data.guaranteedHoursNote}` : ""}`
              : (data.guaranteedHoursNote ?? "")}
          </Text>
          <View style={styles.totalsBox}>
            <Text style={styles.totalsLabel}>TOTAL HOURS FOR WEEK</Text>
            <Text style={styles.totalsValue}>{totalRegularHours.toFixed(2)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>CALL HOURS</Text>
        <View style={styles.callSectionRow}>
          <View style={styles.callTableCol}>
            <Text style={[styles.instructionsTitle, { textAlign: "left", marginBottom: 2 }]}>On-Call</Text>
            <View style={styles.table}>
              <View style={styles.tr}>
                <Text style={[styles.th, { width: "20%" }]}>DAY</Text>
                <Text style={[styles.th, { width: "30%" }]}>TIME-IN</Text>
                <Text style={[styles.th, { width: "30%" }]}>TIME-OUT</Text>
                <Text style={[styles.th, { width: "20%", borderRight: undefined }]}>HOURS</Text>
              </View>
              {data.entries.map((entry) => (
                <View style={styles.tr} key={entry.workDate}>
                  <Text style={[styles.td, { width: "20%" }]}>{dayLabel(entry.workDate)}</Text>
                  <Text style={[styles.td, { width: "30%" }]}>{formatTime12h(entry.onCallTimeIn)}</Text>
                  <Text style={[styles.td, { width: "30%" }]}>{formatTime12h(entry.onCallTimeOut)}</Text>
                  <Text style={[styles.td, { width: "20%", borderRight: undefined }]}>
                    {calculateOnCallHours(entry.onCallTimeIn ?? "", entry.onCallTimeOut ?? "")?.toFixed(2) ?? ""}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={{ fontSize: 6.5, marginTop: 2, fontFamily: "Helvetica-Bold" }}>
              TOTAL ON-CALL HOURS: {totalOnCallHours.toFixed(2)}
            </Text>
          </View>

          <View style={styles.callTableCol}>
            <Text style={[styles.instructionsTitle, { textAlign: "left", marginBottom: 2 }]}>
              Call-Back (only if on-call)
            </Text>
            <View style={styles.table}>
              <View style={styles.tr}>
                <Text style={[styles.th, { width: "18%" }]}>TIME-IN</Text>
                <Text style={[styles.th, { width: "18%" }]}>TIME-OUT</Text>
                <Text style={[styles.th, { width: "14%" }]}>HOURS</Text>
                <Text style={[styles.th, { width: "50%", borderRight: undefined }]}>REASON</Text>
              </View>
              {data.entries.map((entry) => (
                <View style={styles.tr} key={entry.workDate}>
                  <Text style={[styles.td, { width: "18%" }]}>{formatTime12h(entry.callBackTimeIn)}</Text>
                  <Text style={[styles.td, { width: "18%" }]}>{formatTime12h(entry.callBackTimeOut)}</Text>
                  <Text style={[styles.td, { width: "14%" }]}>
                    {calculateCallBackHours(entry.callBackTimeIn ?? "", entry.callBackTimeOut ?? "")?.toFixed(2) ?? ""}
                  </Text>
                  <Text style={[styles.tdLeft, { width: "50%", borderRight: undefined }]}>{entry.callBackReason ?? ""}</Text>
                </View>
              ))}
            </View>
            <Text style={{ fontSize: 6.5, marginTop: 2, fontFamily: "Helvetica-Bold" }}>
              TOTAL CALL-BACK HOURS: {totalCallBackHours.toFixed(2)}
            </Text>
          </View>

          <View style={[styles.callTableCol, { flex: 0.6 }]}>
            <Text style={[styles.instructionsTitle, { textAlign: "left", marginBottom: 2 }]}>Mileage</Text>
            <View style={styles.table}>
              <View style={styles.tr}>
                <Text style={[styles.th, { width: "45%" }]}>DAY</Text>
                <Text style={[styles.th, { width: "55%", borderRight: undefined }]}>MILEAGE</Text>
              </View>
              {data.entries.map((entry) => (
                <View style={styles.tr} key={entry.workDate}>
                  <Text style={[styles.td, { width: "45%" }]}>{dayLabel(entry.workDate)}</Text>
                  <Text style={[styles.td, { width: "55%", borderRight: undefined }]}>{entry.mileage ?? ""}</Text>
                </View>
              ))}
            </View>
            <Text style={{ fontSize: 6.5, marginTop: 2, fontFamily: "Helvetica-Bold" }}>
              TOTAL MILEAGE: {totalMileage}
            </Text>
          </View>
        </View>

        <View style={styles.signatureRow}>
          <View style={styles.signatureCol}>
            <Text style={styles.signatureLine}>
              Employee Signature:{" "}
              <Text style={styles.signatureValue}>
                {data.employeeSignature
                  ? `${data.employeeSignature.name} (submitted electronically ${formatTimestamp(data.employeeSignature.timestamp)})`
                  : "Not yet submitted"}
              </Text>
            </Text>
            <Text style={styles.certText}>
              By my signature above, I hereby certify the hours above are correct and worked by me and I have no
              accidents or injuries to report. Misrepresentation may make myself liable to the maximum penalty
              allowed by law.
            </Text>
          </View>
          <View style={styles.signatureCol}>
            <Text style={styles.signatureLine}>
              Authorized Facility Signature:{" "}
              <Text style={styles.signatureValue}>
                {data.facilitySignature
                  ? `${data.facilitySignature.name} (approved electronically ${formatTimestamp(data.facilitySignature.timestamp)})`
                  : "Not yet approved"}
              </Text>
            </Text>
            <Text style={styles.certText}>
              By my signature above, I hereby certify the hours above are correct and approved for billing and will
              pay according to the hours listed above. Any discrepancies are listed above. Failure to comply may
              make the client facility liable to the maximum penalty allowed by law.
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
