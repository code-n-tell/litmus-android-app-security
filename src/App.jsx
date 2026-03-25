import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, ReferenceLine, Cell,
  Tooltip, LabelList, ResponsiveContainer,
} from "recharts";

// ── 11 RISKS across 7 PLATFORM FEATURES ──────────────────────────────────────

const risks = [
  { id: "PF-01-R01", pf: "PF-01", name: "APK Analysis", severity: "High", goal: "Discovery",
    elaboration: "The APK was decompiled using publicly available tools (apktool, jadx). Internal code structure, API endpoints, authentication mechanisms, and hardcoded values are exposed — lowering the cost of targeted attacks." },
  { id: "PF-01-R02", pf: "PF-01", name: "APK Repackaging", severity: "High", goal: "Defense Evasion",
    elaboration: "The APK was repackaged with modifications and ran successfully on device. An attacker can inject malicious code and redistribute the app as a functional clone." },
  { id: "PF-02-R01", pf: "PF-02", name: "Private Data Access", severity: "High", goal: "Credential Access",
    elaboration: "The app's private data directory (/data/data/<package>) was accessible. Databases, shared preferences, and cached files potentially containing credentials or PII could potentially be extracted." },
  { id: "PF-02-R02", pf: "PF-02", name: "Log Capture", severity: "High", goal: "Collection",
    elaboration: "Runtime logs could potentially be captured via adb logcat while the app was in use. Log output may contain unsanitized session tokens, API responses, or PII leaked through verbose logging." },
  { id: "PF-03-R01", pf: "PF-03", name: "Traffic Interception", severity: "High", goal: "Collection",
    elaboration: "Network traffic was intercepted via HTTP proxy. API requests, authentication tokens, and response data could potentially be captured — enabling session hijacking or data theft." },
  { id: "PF-04-R01", pf: "PF-04", name: "Overlay Attack", severity: "Critical", goal: "Credential Access",
    elaboration: "A malicious app drew a styled overlay over the legitimate interface. Users entering credentials on the fake screen unknowingly submit them to the attacker's app." },
  { id: "PF-05-R01", pf: "PF-05", name: "Programmatic UI Ops", severity: "Critical", goal: "Impact",
    elaboration: "Accessibility services granted to a malicious app enabled programmatic UI interaction — including forced navigation, button clicks, and automated operations — all without visible indication to the user." },
  { id: "PF-05-R02", pf: "PF-05", name: "User Activity Capture", severity: "Critical", goal: "Collection",
    elaboration: "Accessibility services captured user activity including keystrokes, input field content, and interaction patterns — enabling credential harvesting and behavioral surveillance." },
  { id: "PF-05-R03", pf: "PF-05", name: "Text Extraction", severity: "Critical", goal: "Collection",
    elaboration: "Accessibility services extracted all on-screen text content programmatically — enabling mass scraping of displayed PII, financial data, medical records, or credentials." },
  { id: "PF-06-R01", pf: "PF-06", name: "Screen Recording", severity: "High", goal: "Collection",
    elaboration: "Screen content was captured via MediaProjection API. Sensitive information displayed on screen was recorded without the app preventing it." },
  { id: "PF-07-R01", pf: "PF-07", name: "Root Access", severity: "Critical", goal: "Collection",
    elaboration: "On a rooted device, the app's private data directory was accessible via su shell. Databases and files containing sensitive data could potentially be read, copied, or exfiltrated." },
];

// ── MITRE TTP CONSEQUENCES (per risk, platform-wide) ─────────────────────────────

const riskConsequences = {
  "PF-01-R01": "Because the Android platform provides {APK acquisition} feature, your application is at risk of an attacker {analysing the application's APK file}.\nAs a result, this could lead to {discovery — attackers figuring out the APK's vulnerabilities}.",
  "PF-01-R02": "Because the Android platform provides {APK acquisition} feature, your application is at risk of an attacker {repackaging the application's APK file}.\nAs a result, this could lead to {defense evasion — attackers avoid being detected}.",
  "PF-02-R01": "Because the Android platform provides {USB debugging} feature, your application is at risk of an attacker {accessing the application's private data directory}.\nAs a result, this could lead to {credential access — attackers stealing usernames & passwords}.",
  "PF-02-R02": "Because the Android platform provides {USB debugging} feature, your application is at risk of an attacker {capturing the application's runtime logs via Android Debug Bridge (ADB)}.\nAs a result, this could lead to {collection — attackers gathering data of interest like session tokens, credit card numbers to their goal}.",
  "PF-03-R01": "Because the Android platform provides {HTTP proxy} feature, your application is at risk of an attacker {intercepting the application's network traffic}.\nAs a result, this could lead to {collection — attackers trying to gather data of interest to their goal}.",
  "PF-04-R01": "Because the Android platform provides {overlay} feature, your application is at risk of an attacker {drawing over its user interface with a malicious application}.\nAs a result, this could lead to {credential access — attackers stealing usernames & passwords}.",
  "PF-05-R01": "Because the Android platform provides {accessibility services} feature, your application is at risk of an attacker {performing operations programmatically on its user interface}.\nAs a result, this could lead to {impact — attackers manipulating your application}.",
  "PF-05-R02": "Because the Android platform provides {accessibility services} feature, your application is at risk of an attacker {capturing user activities within the app}.\nAs a result, this could lead to {collection — attackers gathering data of interest to their goal}.",
  "PF-05-R03": "Because the Android platform provides {accessibility services} feature, your application is at risk of an attacker {extracting on-screen text}.\nAs a result, this could lead to {collection — attackers trying to gather data of interest to their goal}.",
  "PF-06-R01": "Because the Android platform provides {screen recording} feature, your application is at risk of an attacker {capturing on-screen content}.\nAs a result, this could lead to {collection — attackers gathering data of interest to their goal}.",
  "PF-07-R01": "Because the Android platform provides {rooting} feature, your application is at risk of an attacker {accessing the application's private data directory}.\nAs a result, this could lead to {collection — attackers gathering data of interest to their goal}.",
};

// ── APP-SPECIFIC RISK OBSERVATIONS (from detailed test results) ─────────────

const riskObservations = {
  // PF-01-R01: APK Analysis
  "PF-01-R01": {
    "MigraCare": "We observed that MigraCare's APK can be analysed and has vulnerabilities.",
    "PowerHome": "We observed that PowerHome' APK can be analysed and has vulnerabilities.",
    "CarePal": "We observed that CarePal's APK can be analysed and has vulnerabilities.",
    "CityFix": "We observed that CityFix's APK can be analysed and has vulnerabilities.",
    "MedVault": "We observed that MedVault's APK can be analysed and has vulnerabilities.",
    "TransitOne": "We observed that TransitOne's APK can be analysed and has vulnerabilities.",
    "WorkID Plus": "We observed that WorkID Plus's APK can be analysed and has vulnerabilities.",
    "SecurePass": "We observed that SecurePass's APK can be analysed and has vulnerabilities.",
    "ParkNow": "We observed that ParkNow's APK can be analysed and has vulnerabilities.",
    "CitizenX": "We observed that CitizenX's APK can be analysed and has vulnerabilities.",
    "Health 123": "We observed that Health 123's APK can be analysed and has vulnerabilities.",
    "PensionGo": "We observed that PensionGo's APK can be analysed and has vulnerabilities.",
    "MyBorderPass": "We observed that MyBorderPass's APK can be analysed and has vulnerabilities.",
  },
  // PF-01-R02: APK Repackaging
  "PF-01-R02": {
    "MigraCare": "We observed that MigraCare can be repackaged and runs after repackaging.",
    "PowerHome": "We observed that PowerHome can be repackaged and runs after repackaging.",
    "CityFix": "We observed that CityFix can be repackaged and runs after repackaging.",
    "MyBorderPass": "We observed that MyBorderPass can be repackaged and runs after repackaging.",
    "WorkID Plus": "We observed that WorkID Plus can be repackaged but shows a non-cancellable dialog upon detection of tampering.",
    "CitizenX": "We observed that CitizenX can be repackaged but shows a non-cancellable dialog upon detection of tampering.",
    "Health 123": "We observed that Health 123 can be repackaged but shows a non-cancellable dialog upon detection of tampering.",
    "TransitOne": "We observed that TransitOne can be repackaged but crashes upon launch.",
    "ParkNow": "We observed that ParkNow can be repackaged but crashes upon launch.",
    "PensionGo": "We observed that PensionGo can be repackaged but crashes upon launch.",
    "CarePal": "We observed that CarePal cannot be repackaged.",
    "MedVault": "We observed that MedVault cannot be repackaged.",
    "SecurePass": "We observed that SecurePass cannot be repackaged.",
  },
  // PF-02-R01: Private Data Access
  "PF-02-R01": {
    "MigraCare": "We observed that MigraCare's private data directory is accessible but does not contain sensitive information.",
    "PowerHome": "We observed that PowerHome' private data directory is accessible but does not contain sensitive information.",
    "CityFix": "We observed that CityFix's private data directory is accessible but does not contain sensitive information.",
    "WorkID Plus": "We observed that WorkID Plus's private data directory is accessible but does not contain sensitive information.",
    "ParkNow": "We observed that ParkNow's private data directory is accessible but does not contain sensitive information.",
    "Health 123": "We observed that Health 123's private data directory is accessible but does not contain sensitive information.",
    "MyBorderPass": "We observed that MyBorderPass's private data directory is accessible but does not contain sensitive information.",
    "CitizenX": "We observed that CitizenX's private data directory is accessible and contains sensitive information.",
    "TransitOne": "We observed that TransitOne's private data directory is accessible but does not contain sensitive information, and crashes upon launch after repackaging.",
    "PensionGo": "We observed that PensionGo's private data directory is accessible but does not contain sensitive information, and crashes upon launch after repackaging.",
    "CarePal": "We observed that CarePal's private data directory is not accessible.",
    "MedVault": "We observed that MedVault's private data directory is not accessible.",
    "SecurePass": "We observed that SecurePass's private data directory is not accessible.",
  },
  // PF-02-R02: Log Capture
  "PF-02-R02": {
    "MigraCare": "We observed that MigraCare's runtime logs were captured but do not contain sensitive information.",
    "PowerHome": "We observed that PowerHome' runtime logs were captured but do not contain sensitive information.",
    "CarePal": "We observed that CarePal's runtime logs were captured but do not contain sensitive information.",
    "CityFix": "We observed that CityFix's runtime logs were captured but do not contain sensitive information.",
    "MedVault": "We observed that MedVault's runtime logs were captured but do not contain sensitive information.",
    "TransitOne": "We observed that TransitOne's runtime logs were captured but do not contain sensitive information.",
    "ParkNow": "We observed that ParkNow's runtime logs were captured but do not contain sensitive information.",
    "CitizenX": "We observed that CitizenX's runtime logs were captured but do not contain sensitive information.",
    "Health 123": "We observed that Health 123's runtime logs were captured but do not contain sensitive information.",
    "MyBorderPass": "We observed that MyBorderPass's runtime logs were captured but do not contain sensitive information.",
    "WorkID Plus": "We observed that WorkID Plus's runtime logs could not be captured but shows a non-cancellable dialog upon detection of USB debugging.",
    "SecurePass": "We observed that SecurePass's runtime logs could not be captured but shows a non-cancellable dialog upon detection of USB debugging.",
    "PensionGo": "We observed that PensionGo's runtime logs could not be captured but shows a non-cancellable dialog upon detection of USB debugging.",
  },
  // PF-03-R01: Traffic Interception
  "PF-03-R01": {
    "CityFix": "We observed that CityFix's network traffic was intercepted and contains sensitive information.",
    "CitizenX": "We observed that CitizenX's network traffic was intercepted and contains sensitive information.",
    "Health 123": "We observed that Health 123's network traffic was intercepted and contains sensitive information.",
    "MigraCare": "We observed that MigraCare's network traffic could not be intercepted but shows a non-cancellable dialog upon detection of proxy.",
    "PowerHome": "We observed that PowerHome' network traffic could not be intercepted but shows a non-cancellable dialog upon detection of proxy.",
    "SecurePass": "We observed that SecurePass's network traffic could not be intercepted but shows a non-cancellable dialog upon detection of proxy.",
    "ParkNow": "We observed that ParkNow's network traffic could not be intercepted but shows a non-cancellable dialog upon detection of proxy.",
    "PensionGo": "We observed that PensionGo's network traffic could not be intercepted but shows a non-cancellable dialog upon detection of proxy.",
    "CarePal": "We observed that CarePal crashes upon launch.",
    "MedVault": "We observed that MedVault crashes upon launch.",
    "TransitOne": "We observed that TransitOne crashes upon launch.",
    "WorkID Plus": "We observed that WorkID Plus crashes upon launch.",
    "MyBorderPass": "We observed that MyBorderPass crashes upon launch.",
  },
  // PF-04-R01: Overlay Attack
  "PF-04-R01": {
    "MigraCare": "We observed that MigraCare allows other apps to draw over its interface but user interface does not contain sensitive information.",
    "PowerHome": "We observed that PowerHome allows other apps to draw over its interface but user interface does not contain sensitive information.",
    "CarePal": "We observed that CarePal allows other apps to draw over its interface but user interface does not contain sensitive information.",
    "CityFix": "We observed that CityFix allows other apps to draw over its interface but user interface does not contain sensitive information.",
    "TransitOne": "We observed that TransitOne allows other apps to draw over its interface but user interface does not contain sensitive information.",
    "WorkID Plus": "We observed that WorkID Plus allows other apps to draw over its interface but user interface does not contain sensitive information.",
    "ParkNow": "We observed that ParkNow allows other apps to draw over its interface but user interface does not contain sensitive information.",
    "CitizenX": "We observed that CitizenX allows other apps to draw over its interface but user interface does not contain sensitive information.",
    "Health 123": "We observed that Health 123 allows other apps to draw over its interface but user interface does not contain sensitive information.",
    "PensionGo": "We observed that PensionGo allows other apps to draw over its interface but user interface does not contain sensitive information.",
    "MyBorderPass": "We observed that MyBorderPass allows other apps to draw over its interface but user interface does not contain sensitive information.",
    "MedVault": "We observed that MedVault disables overlay while it is in use.",
    "SecurePass": "We observed that SecurePass disables overlay while it is in use.",
  },
  // PF-05-R01: Programmatic UI Ops (Accessibility Abuse)
  "PF-05-R01": {
    "PowerHome": "We observed that PowerHome allows accessibility services and allows sensitive operations to be performed programmatically.",
    "CarePal": "We observed that CarePal allows accessibility services and allows sensitive operations to be performed programmatically.",
    "CityFix": "We observed that CityFix allows accessibility services and allows sensitive operations to be performed programmatically.",
    "CitizenX": "We observed that CitizenX allows accessibility services and allows sensitive operations to be performed programmatically.",
    "Health 123": "We observed that Health 123 allows accessibility services and allows sensitive operations to be performed programmatically.",
    "MyBorderPass": "We observed that MyBorderPass allows accessibility services and allows sensitive operations to be performed programmatically.",
    "MedVault": "We observed that MedVault allows accessibility services but disallows sensitive operations to be performed programmatically.",
    "SecurePass": "We observed that SecurePass allows accessibility services but disallows sensitive operations to be performed programmatically.",
    "MigraCare": "We observed that MigraCare allows accessibility services.",
    "TransitOne": "We observed that TransitOne allows accessibility services.",
    "WorkID Plus": "We observed that WorkID Plus allows accessibility services.",
    "ParkNow": "We observed that ParkNow allows accessibility services.",
    "PensionGo": "We observed that PensionGo disallows accessibility services but shows a non-cancellable dialog upon detection of accessibility services.",
  },
  // PF-05-R02: User Activity Capture
  "PF-05-R02": {
    "MigraCare": "We observed that MigraCare allows accessibility services and sensitive user activities were captured.",
    "CityFix": "We observed that CityFix allows accessibility services and sensitive user activities were captured.",
    "SecurePass": "We observed that SecurePass allows accessibility services and sensitive user activities were captured.",
    "ParkNow": "We observed that ParkNow allows accessibility services and sensitive user activities were captured.",
    "CitizenX": "We observed that CitizenX allows accessibility services and sensitive user activities were captured.",
    "Health 123": "We observed that Health 123 allows accessibility services and sensitive user activities were captured.",
    "MyBorderPass": "We observed that MyBorderPass allows accessibility services and sensitive user activities were captured.",
    "PowerHome": "We observed that PowerHome allows accessibility services.",
    "CarePal": "We observed that CarePal allows accessibility services.",
    "MedVault": "We observed that MedVault allows accessibility services.",
    "TransitOne": "We observed that TransitOne allows accessibility services.",
    "WorkID Plus": "We observed that WorkID Plus allows accessibility services.",
    "PensionGo": "We observed that PensionGo disallows accessibility services but shows a non-cancellable dialog upon detection of accessibility services.",
  },
  // PF-05-R03: Text Extraction
  "PF-05-R03": {
    "MigraCare": "We observed that MigraCare allows accessibility services and on-screen text was scraped.",
    "PowerHome": "We observed that PowerHome allows accessibility services and on-screen text was scraped.",
    "CarePal": "We observed that CarePal allows accessibility services and on-screen text was scraped.",
    "CityFix": "We observed that CityFix allows accessibility services and on-screen text was scraped.",
    "MedVault": "We observed that MedVault allows accessibility services and on-screen text was scraped.",
    "TransitOne": "We observed that TransitOne allows accessibility services and on-screen text was scraped.",
    "WorkID Plus": "We observed that WorkID Plus allows accessibility services and on-screen text was scraped.",
    "SecurePass": "We observed that SecurePass allows accessibility services and on-screen text was scraped.",
    "ParkNow": "We observed that ParkNow allows accessibility services and on-screen text was scraped.",
    "CitizenX": "We observed that CitizenX allows accessibility services and on-screen text was scraped.",
    "Health 123": "We observed that Health 123 allows accessibility services and on-screen text was scraped.",
    "MyBorderPass": "We observed that MyBorderPass allows accessibility services and on-screen text was scraped.",
    "PensionGo": "We observed that PensionGo disallows accessibility services but shows a non-cancellable dialog upon detection of accessibility services.",
  },
  // PF-06-R01: Screen Recording
  "PF-06-R01": {
    "MigraCare": "We observed that MigraCare's screen recording was captured successfully.",
    "PowerHome": "We observed that PowerHome' screen recording was captured successfully.",
    "CarePal": "We observed that CarePal's screen recording was captured successfully.",
    "CityFix": "We observed that CityFix's screen recording was captured successfully.",
    "MedVault": "We observed that MedVault's screen recording was captured successfully.",
    "TransitOne": "We observed that TransitOne's screen recording was captured successfully.",
    "WorkID Plus": "We observed that WorkID Plus's screen recording was captured successfully.",
    "ParkNow": "We observed that ParkNow's screen recording was captured successfully.",
    "CitizenX": "We observed that CitizenX's screen recording was captured successfully.",
    "Health 123": "We observed that Health 123's screen recording was captured successfully.",
    "PensionGo": "We observed that PensionGo's screen recording was captured successfully.",
    "MyBorderPass": "We observed that MyBorderPass's screen recording was captured successfully.",
    "SecurePass": "We observed that SecurePass's screen recording was not captured successfully - a black screen.",
  },
  // PF-07-R01: Root Access
  "PF-07-R01": {
    "MigraCare": "We observed that MigraCare's private data directory is accessible but does not contain sensitive information.",
    "PowerHome": "We observed that PowerHome' private data directory is accessible but does not contain sensitive information.",
    "CityFix": "We observed that CityFix's private data directory is accessible but does not contain sensitive information.",
    "WorkID Plus": "We observed that WorkID Plus's private data directory is accessible but does not contain sensitive information.",
    "SecurePass": "We observed that SecurePass's private data directory is accessible but does not contain sensitive information.",
    "ParkNow": "We observed that ParkNow's private data directory is accessible but does not contain sensitive information.",
    "Health 123": "We observed that Health 123's private data directory is accessible but does not contain sensitive information.",
    "PensionGo": "We observed that PensionGo's private data directory is accessible but does not contain sensitive information.",
    "CitizenX": "We observed that CitizenX's private data directory is accessible and contains sensitive information.",
    "CarePal": "We observed that CarePal's private data directory does not exist - the emulator lacks ARM64 support, preventing the app from launching.",
    "MedVault": "We observed that MedVault's private data directory does not exist - the emulator lacks ARM64 support, preventing the app from launching.",
    "TransitOne": "We observed that TransitOne's private data directory does not exist - the emulator lacks ARM64 support, preventing the app from launching.",
    "MyBorderPass": "We observed that MyBorderPass's private data directory does not exist - the emulator lacks ARM64 support, preventing the app from launching.",
  },
};

// ── CISO CALL TO ACTION (per risk) ──────────────────────────────────────────

const riskCallToAction = {
  "PF-01-R01": "Mandate code obfuscation (ProGuard/R8) as a build-time baseline and remove all hardcoded secrets from the APK.",
  "PF-01-R02": "Enforce APK signature verification and anti-tampering detection. All apps must prevent execution of repackaged versions.",
  "PF-02-R01": "Prohibit release builds with android:debuggable=true. Enforce private directory access restrictions and data-at-rest encryption.",
  "PF-02-R02": "Mandate production log sanitisation: suppress verbose logging in release builds. Require log filtering as part of the app release approval process.",
  "PF-03-R01": "Implement certificate pinning or a strict Network Security Configuration. 10 peer apps already enforce this — no technical barrier exists.",
  "PF-04-R01": "Deploy TYPE_APPLICATION_OVERLAY detection and blocking on all credential and sensitive input screens.",
  "PF-05-R01": "Implement a non-cancellable accessibility abuse detection dialog that blocks programmatic UI interactions from external accessibility services.",
  "PF-05-R02": "Block accessibility service input capture on all credential entry screens immediately. This vector was used to capture SecurePass national ID and password.",
  "PF-05-R03": "Apply FLAG_SECURE and restrict ViewStructure traversal on all screens handling PII, credentials, or financial data.",
  "PF-06-R01": "Mandate FLAG_SECURE on all screens displaying sensitive data to prevent screen capture. Only 1 the app (SecurePass) currently enforces this.",
  "PF-07-R01": "Implement root detection (Play Integrity API) and enforce data-at-rest encryption for all locally stored sensitive data.",
};

// Guide controls for email template "What can be done better?" section
const riskControls = {
  "PF-01-R01": "can prevent the risk of an attacker analysing the application's APK file",
  "PF-01-R02": "can prevent the risk of an attacker repackaging the application's APK file",
  "PF-02-R01": "can prevent the risk of an attacker accessing the application's private data directory",
  "PF-02-R02": "can prevent the risk of an attacker capturing the application's runtime logs via Android Debug Bridge (ADB)",
  "PF-03-R01": "can prevent the risk of an attacker intercepting the application's network traffic",
  "PF-04-R01": "can prevent the risk of an attacker drawing over its user interface with a malicious application",
  "PF-05-R01": "can prevent the risk of an attacker performing operations programmatically on its user interface",
  "PF-05-R02": "can prevent the risk of an attacker capturing user activities within the app",
  "PF-05-R03": "can prevent the risk of an attacker extracting on-screen text",
  "PF-06-R01": "can prevent the risk of an attacker capturing on-screen content",
  "PF-07-R01": "can prevent the risk of an attacker accessing the application's private data directory",
};

const afObservationOptions = {
  "PF-01-R01": {
    atRisk: ["APK can be analysed", "APK has vulnerabilities"],
    notAtRisk: [],
  },
  "PF-01-R02": {
    atRisk: ["Can be repackaged", "Runs after repackaging"],
    notAtRisk: ["Cannot be repackaged - obfuscation", "Runs after repackaging with non-cancellable dialog", "Crashes upon launch after repackaging"],
  },
  "PF-02-R01": {
    atRisk: ["Private data directory is accessible", "Contains no sensitive information", "Contains sensitive information"],
    notAtRisk: ["Private data directory is not accessible - Cannot be repackaged", "Crashes upon launch after repackaging"],
  },
  "PF-02-R02": {
    atRisk: ["Runtime logs were captured", "Contain no sensitive information", "Contain sensitive information"],
    notAtRisk: ["Runs with non-cancellable dialog when USB debugging is detected"],
  },
  "PF-03-R01": {
    atRisk: ["Network traffic was intercepted", "Contain sensitive information"],
    notAtRisk: ["Runs with non-cancellable dialog when HTTP proxy is detected", "Crashes upon launch"],
  },
  "PF-04-R01": {
    atRisk: ["Allows other apps to draw over its interface", "Contain no sensitive information", "Contain sensitive information"],
    notAtRisk: ["Disables overlay while it is in use"],
  },
  "PF-05-R01": {
    atRisk: ["Allows accessibility services", "Allows sensitive operations to be performed programmatically", "Does not allow sensitive operations to be performed programmatically"],
    notAtRisk: ["Runs with non-cancellable dialog when accessibility services are detected"],
  },
  "PF-05-R02": {
    atRisk: ["Allows accessibility services", "Sensitive user activities were captured"],
    notAtRisk: ["Runs with non-cancellable dialog when accessibility services are detected"],
  },
  "PF-05-R03": {
    atRisk: ["Allows accessibility services", "On-screen text was scraped"],
    notAtRisk: ["Runs with non-cancellable dialog when accessibility services are detected"],
  },
  "PF-06-R01": {
    atRisk: ["Screen recording was captured successfully"],
    notAtRisk: ["Screen recording was not captured successfully - a black screen"],
  },
  "PF-07-R01": {
    atRisk: ["Private data directory is accessible", "Contains no sensitive information", "Contains sensitive information"],
    notAtRisk: ["Private data directory does not exist - no arm64 support, app cannot launch"],
  },
};

// MITRE ATT&CK Mobile tactic URLs (https://attack.mitre.org/tactics/mobile/)
const mitreTacticUrls = {
  "discovery":        "https://attack.mitre.org/tactics/TA0032/",
  "defense evasion":  "https://attack.mitre.org/tactics/TA0030/",
  "credential access":"https://attack.mitre.org/tactics/TA0031/",
  "collection":       "https://attack.mitre.org/tactics/TA0035/",
  "impact":           "https://attack.mitre.org/tactics/TA0034/",
};

// Per-risk formatted note: "[factual statement], potentially [consequence]"
const riskNoteFormatted = {
  "PF-01-R01": "APK decompiled, potentially revealing internal code structure, API endpoints, and exploitable logic",
  "PF-01-R02": "APK repackaged, potentially allowing malicious spoofing of the legitimate app",
  "PF-02-R01": "Private data directory accessible, potentially revealing sensitive user information stored locally",
  "PF-02-R02": "Runtime logs captured, potentially exposing session tokens, API responses, and sensitive identifiers",
  "PF-03-R01": "Network traffic intercepted, potentially exposing authentication tokens and live session data",
  "PF-04-R01": "Overlay drawn over app interface, potentially enabling credential theft via a phishing screen",
  "PF-05-R01": "Accessibility services enabled, potentially allowing programmatic UI control without user awareness",
  "PF-05-R02": "User activity captured via accessibility services, potentially revealing keystrokes and credentials",
  "PF-05-R03": "On-screen text extracted via accessibility services, potentially revealing PII, credentials, and sensitive content",
  "PF-06-R01": "Screen recording captured successfully, potentially revealing sensitive on-screen content",
  "PF-07-R01": "Private data directory accessed on rooted device, potentially exposing sensitive files and credentials",
};

const platformFeatures = [
  { id: "PF-01", name: "APK acquisition", additionalContext: "" },
  { id: "PF-02", name: "USB debugging", additionalContext: "" },
  { id: "PF-03", name: "HTTP proxy", additionalContext: "" },
  { id: "PF-04", name: "Overlay", additionalContext: "" },
  { id: "PF-05", name: "Accessibility services", additionalContext: "" },
  { id: "PF-06", name: "Screen recording", additionalContext: "" },
  { id: "PF-07", name: "Rooting", additionalContext: "" },
];

// Renders consequence text:
//   First {action}   → bold red highlight (the attack action)
//   Second {tactic — description} → tactic name hyperlinked to MITRE Mobile, description plain
const renderConsequence = (text) => {
  if (!text) return null;
  // Split on newlines first to render as separate lines
  const lines = text.split("\n");
  return lines.map((line, li) => {
    const parts = line.split(/(\{[^}]+\})/g);
    let curlyCount = 0;
    // Count total curly groups in this line to identify the last one as MITRE tactic
    const totalCurly = parts.filter(p => p.startsWith("{") && p.endsWith("}")).length;
    return (
      <React.Fragment key={li}>
        {li > 0 && <br />}
        {parts.map((part, i) => {
          if (part.startsWith("{") && part.endsWith("}")) {
            const inner = part.slice(1, -1);
            curlyCount++;
            // Last curly group on "As a result" line = MITRE tactic link
            if (line.startsWith("As a result") && curlyCount === totalCurly) {
              const dashIdx = inner.indexOf(" \u2014 ");
              if (dashIdx !== -1) {
                const tactic = inner.slice(0, dashIdx).trim();
                const description = inner.slice(dashIdx + 3).trim();
                const url = mitreTacticUrls[tactic.toLowerCase()];
                return (
                  <span key={i}>
                    {url
                      ? <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, color: "#2563eb", textDecoration: "underline", textUnderlineOffset: "2px" }}>{tactic}</a>
                      : <span style={{ fontWeight: 700, color: "#2563eb" }}>{tactic}</span>
                    }
                    {" \u2014 "}
                    <span style={{ color: "#374151" }}>{description}</span>
                  </span>
                );
              }
              return <span key={i} style={{ fontWeight: 700, color: "#2563eb" }}>{inner}</span>;
            }
            // All other curly groups = red highlight (platform feature, attacker action)
            return (
              <span key={i} style={{ fontWeight: 700, color: "#dc2626", background: "#fee2e218", padding: "1px 5px", borderRadius: 3 }}>
                {inner}
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </React.Fragment>
    );
  });
};


let MAX_SCORE = risks.length; // 11

const replaceArrayContents = (target, nextValue) => {
  if (!Array.isArray(target) || !Array.isArray(nextValue)) return;
  target.splice(0, target.length, ...nextValue);
};

const replaceObjectContents = (target, nextValue) => {
  if (!target || typeof target !== "object" || !nextValue || typeof nextValue !== "object") return;
  Object.keys(target).forEach((key) => delete target[key]);
  Object.assign(target, nextValue);
};

const applyDashboardData = (payload) => {
  if (!payload || typeof payload !== "object") return;

  if (Array.isArray(payload.platformFeatures) && payload.platformFeatures.length > 0) {
    const mergedPlatformFeatures = [...platformFeatures];
    payload.platformFeatures.forEach((incomingPf) => {
      const idx = mergedPlatformFeatures.findIndex((pf) => pf.id === incomingPf.id);
      if (idx >= 0) {
        mergedPlatformFeatures[idx] = { ...mergedPlatformFeatures[idx], ...incomingPf };
      } else {
        mergedPlatformFeatures.push(incomingPf);
      }
    });
    replaceArrayContents(platformFeatures, mergedPlatformFeatures);
  }
  replaceArrayContents(risks, payload.risks);
  replaceObjectContents(riskConsequences, payload.riskConsequences);
  replaceObjectContents(riskObservations, payload.riskObservations);
  replaceObjectContents(riskCallToAction, payload.riskCallToAction);
  replaceObjectContents(riskNoteFormatted, payload.riskNoteFormatted);
  if (payload.afObservationOptions) {
    replaceObjectContents(afObservationOptions, payload.afObservationOptions);
  }
  replaceArrayContents(apps, payload.apps);
  replaceArrayContents(sectors, payload.sectors);

  MAX_SCORE = risks.length;
};

// ── 13 APPS — status: ["blocked"|"succeeded"|"exposed", note, elaboration?] ─

const apps = [
  {
    name: "SecurePass", agency: "NexaTech", sector: "identity",
    status: {
      "PF-01-R01": ["succeeded", "APK decompiled — internal auth flows revealed",
        "SecurePass APK can potentially be decompiled to expose internal authentication flows, API endpoints used for service integration, and security mechanism implementations. This enables targeted attack planning against the national identity platform."],
      "PF-01-R02": ["blocked", "Obfuscated XMLs prevent repackaging"],
      "PF-02-R01": ["blocked", "Repackaging with debuggable flag failed"],
      "PF-02-R02": ["blocked", "Blocks execution when USB debugging enabled"],
      "PF-03-R01": ["blocked", "Non-cancellable alert dialog triggered"],
      "PF-04-R01": ["blocked", "Disables overlays while app is in use"],
      "PF-05-R01": ["succeeded", "Accessibility services enabled",
        "Accessibility services enabled programmatic interactions with SecurePass UI elements — including navigation, button clicks, and forced logout — without user awareness."],
      "PF-05-R02": ["exposed", "national ID and Password captured at login page",
        "An accessibility service running alongside SecurePass captured the user's national ID and password as they could potentially be typed at the login page. As the gateway to all platform services, these credentials grant cascading access to financial, health, immigration, and citizen service accounts."],
      "PF-05-R03": ["succeeded", "On-screen text extracted",
        "Text displayed on SecurePass screens was extracted via accessibility services. Displayed profile information and service details could potentially be captured."],
      "PF-06-R01": ["blocked", "Screen recording captured black screen only"],
      "PF-07-R01": ["succeeded", "Disallowed runtime on rooted device, but private data directory was accessible"],
    },
  },
  {
    name: "PensionGo", agency: "National Pension Fund", sector: "financial",
    status: {
      "PF-01-R01": ["succeeded", "APK decompiled — attackers could potentially exploit API endpoints",
        "PensionGo's APK can potentially be decompiled to expose financial API endpoints, authentication flow, and internal logic handling pension balance queries and transactions."],
      "PF-01-R02": ["blocked", "Crashes after repackaging"],
      "PF-02-R01": ["succeeded", "Private data directory accessible",
        "After repackaging with the debuggable flag, PensionGo's private data directory was accessible. Stored financial session data, cached account info, and shared preferences could potentially be extracted."],
      "PF-02-R02": ["blocked", "Blocks execution when USB debugging enabled"],
      "PF-03-R01": ["blocked", "Non-cancellable alert dialog triggered"],
      "PF-04-R01": ["succeeded", "Overlay drawn over interface",
        "A malicious app drew a fake login overlay over PensionGo's interface. Citizens entering their pension credentials would unknowingly submit them to the attacker — directly exposing retirement savings accounts."],
      "PF-05-R01": ["blocked", "Non-cancellable dialog blocks accessibility abuse"],
      "PF-05-R02": ["blocked", "Non-cancellable dialog blocks accessibility abuse"],
      "PF-05-R03": ["blocked", "Non-cancellable dialog blocks accessibility abuse"],
      "PF-06-R01": ["succeeded", "Screen recording allowed but blocked with warning message"],
      "PF-07-R01": ["succeeded", "Disallowed runtime on rooted device, but private data directory was accessible"],
    },
  },
  {
    name: "MedVault", agency: "MedSys", sector: "healthcare",
    status: {
      "PF-01-R01": ["succeeded", "APK decompiled — attackers could potentially exploit health data API",
        "MedVault's APK can potentially be decompiled to expose health data API structure, endpoints handling medical records, and appointment scheduling logic."],
      "PF-01-R02": ["blocked", "Obfuscated XMLs prevented repackaging"],
      "PF-02-R01": ["blocked", "Repackaging with debuggable flag failed, thus the private data directory was not accessible"],
      "PF-02-R02": ["succeeded", "Runtime logs captured",
        "Runtime logs captured via ADB may contain health API request/response data, appointment details, or patient identifiers leaked through verbose logging."],
      "PF-03-R01": ["blocked", "Crashes on app launch with proxy in place"],
      "PF-04-R01": ["blocked", "Disables overlays while app is in use"],
      "PF-05-R01": ["succeeded", "Accessibility services enabled, though programmatic interactions could potentially be unsuccessful",
        "Accessibility services enabled programmatic interactions with MedVault — including forced navigation and button interactions on medical record screens."],
      "PF-05-R02": ["succeeded", "Accessibility services enabled, but no user activity captured",
        "User activity on medical record screens was captured — including navigation patterns through health records, appointments, and screening results."],
      "PF-05-R03": ["exposed", "Medical records scraped from screen",
        "On-screen medical text was scraped via accessibility services — including displayed diagnoses, prescriptions, health screening results, and appointment details."],
      "PF-06-R01": ["succeeded", "Screen recording captured successfully",
        "Medical record screens, health screening results, and appointment details could potentially be captured via screen recording without any restriction."],
      "PF-07-R01": ["succeeded", "Crashing on rooted device but access not fully blocked",
        "The app exhibited unexpected crashing on rooted device. The private data directory was not accessible."],
    },
  },
  {
    name: "CarePal", agency: "National Health Group", sector: "healthcare",
    status: {
      "PF-01-R01": ["succeeded", "APK decompiled — attackers could potentially exploit health service API",
        "CarePal's APK could potentially be decompiled to reveal health service API endpoints and internal logic handling patient interactions."],
      "PF-01-R02": ["blocked", "XML decode failures due to obfuscation prevented repackaging"],
      "PF-02-R01": ["blocked", "Repackaging with debuggable flag failed"],
      "PF-02-R02": ["succeeded", "Runtime logs captured",
        "Runtime logs captured via ADB while CarePal was in use. Health-related API calls and patient interaction data may appear in unsanitized log output."],
      "PF-03-R01": ["blocked", "Crashes on app launch with proxy"],
      "PF-04-R01": ["succeeded", "Overlay drawn over interface",
        "A phishing overlay can potentially be drawn over CarePal's login or patient interaction screens, capturing healthcare credentials or personal health information."],
      "PF-05-R01": ["succeeded", "Programmatic UI operations performed",
        "Accessibility services enabled programmatic operations including forced logout from active health consultation sessions."],
      "PF-05-R02": ["succeeded", "Accessibility services enabled, but no user activity captured",
        "User interactions with health consultation screens could potentially be captured via accessibility services."],
      "PF-05-R03": ["exposed", "Accessibility services enabled, on-screen text captured",
        "On-screen text extracted from health consultation screens — including prescriptions, patient data, and health recommendations."],
      "PF-06-R01": ["succeeded", "Screen recording captured successfully",
        "Patient consultation data, health information, and personal details displayed on screen could potentially be captured via screen recording without restriction."],
      "PF-07-R01": ["blocked", "Disallowed runtime on rooted device"],
    },
  },
  {
    name: "Health 123", agency: "WPA", sector: "healthcare",
    status: {
      "PF-01-R01": ["succeeded", "APK decompiled — potential exposure of health tracking API",
        "Health 123's APK could potentially be decompiled to expose health activity tracking APIs, reward point logic, and personal profile data handling."],
      "PF-01-R02": ["blocked", "Non-cancellable dialog triggered after repackaging"],
      "PF-02-R01": ["succeeded", "Private data directory accessible",
        "The private data directory was accessible, potentially exposing cached health activity data, reward points, and personal profile information."],
      "PF-02-R02": ["succeeded", "Runtime logs captured",
        "Runtime logs captured via ADB. Health activity submissions and API responses may contain personal health metrics leaked through verbose logging."],
      "PF-03-R01": ["exposed", "Tokens and Cookies intercepted",
        "Session tokens and cookies could potentially be intercepted via HTTP proxy. An attacker could potentially replay these to access health activity data, reward points, and personal health profiles linked to the user's account."],
      "PF-04-R01": ["succeeded", "Overlay drawn over interface",
        "A phishing overlay can capture WPA login credentials, granting access to the user's health activity history and personal health profile."],
      "PF-05-R01": ["succeeded", "Programmatic UI operations performed",
        "Accessibility services enabled programmatic interactions with Health 123 UI elements."],
      "PF-05-R02": ["succeeded", "User activity captured",
        "User health activity interactions could potentially be captured via accessibility services."],
      "PF-05-R03": ["exposed", "Health metrics and profile data scraped",
        "On-screen health data text was scraped — including health metrics, step counts, and personal profile details."],
      "PF-06-R01": ["succeeded", "Screen recording captured successfully",
        "Health activity screens, personal profile, and reward data could potentially be captured via screen recording without restriction."],
      "PF-07-R01": ["exposed", "Full root access — private data directory",
        "The app ran without restriction on a rooted device. The private data directory was accessible and could potentially be exfiltrated."],
    },
  },
  {
    name: "MyBorderPass", agency: "NBA", sector: "immigration",
    status: {
      "PF-01-R01": ["succeeded", "APK decompiled — immigration API revealed",
        "MyBorderPass's APK can potentially be decompiled to expose immigration service API endpoints, passport data handling logic, and travel record query mechanisms."],
      "PF-01-R02": ["succeeded", "Repackaged and runs successfully",
        "The APK was successfully repackaged and the modified version ran on device. A functional malicious clone of the national border app could potentially be distributed to harvest passport data and travel records from citizens."],
      "PF-02-R01": ["succeeded", "Private data directory accessible",
        "The private data directory was accessible."],
      "PF-02-R02": ["succeeded", "Runtime logs captured",
        "Runtime logs captured via ADB."],
      "PF-03-R01": ["blocked", "Crashes on app launch with proxy"],
      "PF-04-R01": ["succeeded", "Overlay drawn over interface",
        "A phishing overlay can capture NBA login credentials, granting access to the user's passport data, immigration records, and travel history."],
      "PF-05-R01": ["succeeded", "Programmatic UI operations performed",
        "Accessibility services enabled programmatic operations on immigration service screens."],
      "PF-05-R02": ["succeeded", "Accerssibility services could potentially be allowed, but no user activity captured",
        "User interactions with passport and immigration screens could potentially be captured."],
      "PF-05-R03": ["exposed", "On-Screen Data Scraped",
        "On-screen text extracted from screens displaying passport details, visa status, and immigration records."],
      "PF-06-R01": ["succeeded", "Screen recording captured successfully",
        "Passport details, immigration status, and travel history displayed on screen could potentially be captured via screen recording."],
      "PF-07-R01": ["succeeded", "Crashing on rooted device but access not fully blocked",
        "The app exhibited crashing behavior on rooted device but did not fully prevent access."],
    },
  },
  {
    name: "WorkID Plus", agency: "MOL", sector: "workforce",
    status: {
      "PF-01-R01": ["succeeded", "APK decompiled ",
        "WorkID Plus APK can potentially be decompiled to expose work permit data"],
      "PF-01-R02": ["blocked", "Detects tampered app; blocks execution"],
      "PF-02-R01": ["succeeded", "Private data directory accessible",
        "The private data directory was accessible potentially exposing PII"],
      "PF-02-R02": ["blocked", "Blocks execution when USB debugging enabled"],
      "PF-03-R01": ["blocked", "Crashes on app launch with proxy"],
      "PF-04-R01": ["succeeded", "Overlay drawn over interface",
        "A phishing overlay can capture MOL login credentials on work permit screens, enabling unauthorized access to foreign worker employment data."],
      "PF-05-R01": ["succeeded", "Programmatic UI operations could potentially be performed, testing was limited due to lack of credentials",
        "Accessibility services could enable programmatic interactions with work permit screens."],
      "PF-05-R02": ["succeeded", "Accessibility Services enabled, no User activity captured",
        "User interactions with work permit and employment screens could potentially be captured."],
      "PF-05-R03": ["exposed", "On-screen text scraped",
        "On-screen work permit details, employment information, and worker personal identifiers could POTENTIALLY be scraped via accessibility services."],
      "PF-06-R01": ["succeeded", "Screen recording captured successfully",
        "Work permit screens displaying worker identity details and employment information could potentially be captured via screen recording without restriction."],
      "PF-07-R01": ["succeeded", "Disallowed runtime on rooted device, but private data directory was accessible as root."],
    },
  },
  {
    name: "MigraCare", agency: "MOL", sector: "workforce",
    status: {
      "PF-01-R01": ["succeeded", "APK decompiled — welfare case API revealed",
        "MigraCare's APK can potentially be decompiled to expose data."],
      "PF-01-R02": ["succeeded", "Repackaged and runs successfully",
        "The APK can potentially be repackaged and run successfully. A malicious clone targeting foreign workers — who may be less able to distinguish official from fake apps — could harvest work credentials and personal identifiers."],
      "PF-02-R01": ["succeeded", "Private data directory accessible",
        "The private data directory was accessible. Potentially exposing Cached worker welfare case data, personal identifiers, and employment details."],
      "PF-02-R02": ["succeeded", "Runtime logs captured",
        "Runtime logs captured via ADB. Welfare case submissions and worker identity data may appear in unsanitized log output."],
      "PF-03-R01": ["blocked", "Non-cancellable alert dialog triggered"],
      "PF-04-R01": ["succeeded", "Overlay drawn over interface",
        "A phishing overlay can capture MOL welfare portal credentials from foreign workers who rely on this app for case management and support services."],
      "PF-05-R01": ["succeeded", "Accessibility services enabled, programmatic UI operations could potentially be performed",
        "Accessibility services could enable programmatic interactions with welfare case management screens."],
      "PF-05-R02": ["exposed", "Accessibility services enabled, Worker identity data could potentially be captured during activity",
        "User activity was captured via accessibility — including welfare case interactions, worker identity details, and personal data entry."],
      "PF-05-R03": ["succeeded", "On-screen text extracted",
        "Text from welfare case screens could potentially be extracted via accessibility services."],
      "PF-06-R01": ["succeeded", "Screen recording captured successfully",
        "Welfare case screens, worker identity details, and personal information could potentially be captured via screen recording without restriction."],
      "PF-07-R01": ["succeeded", "Non-cancellable alert dialog on rooted device, but private data directory is accessible"],
    },
  },
  {
    name: "CitizenX", agency: "NexaTech", sector: "citizen",
    status: {
      "PF-01-R01": ["succeeded", "APK decompiled — aggregated gov service API revealed",
        "CitizenX's APK can potentially be decompiled to expose aggregated government service APIs, benefits data handling, and personal profile management logic."],
      "PF-01-R02": ["blocked", "Non-cancellable dialog triggered after repackaging"],
      "PF-02-R01": ["exposed", "Display name and UID found in RKStorage Database",
        "The private data directory contained an RKStorage database storing the user's display name and UID in plaintext — directly exploitable PII that identifies the citizen across government services."],
      "PF-02-R02": ["succeeded", "Runtime logs captured",
        "Runtime logs captured via ADB. As an aggregator of government services, log output may leak data spanning financial, health, and identity services."],
      "PF-03-R01": ["exposed", "Tokens and Cookies intercepted",
        "Authentication tokens and cookies could potentially be intercepted via HTTP proxy. These could potentially be replayed to hijack active CitizenX sessions and access aggregated government service data across multiple agencies."],
      "PF-04-R01": ["succeeded", "Overlay drawn over interface",
        "A phishing overlay can capture CitizenX credentials, granting access to the user's aggregated government services profile, benefits data, and linked service accounts."],
      "PF-05-R01": ["succeeded", "Programmatic UI operations performed",
        "Accessibility services enabled programmatic interactions with government service screens."],
      "PF-05-R02": ["succeeded", "Accessibility Services Enabled, User activity captured",
        "User interactions with aggregated government services could potentially be captured."],
      "PF-05-R03": ["succeeded", "Accessibility Services Enabled, On-screen text scraped",
        "On-screen text scraped — including personal profile data, benefits information, and government service interactions spanning multiple agencies."],
      "PF-06-R01": ["succeeded", "Screen recording captured successfully",
        "Personal profile, benefits data, and aggregated government service screens could potentially be captured via screen recording without restriction."],
      "PF-07-R01": ["exposed", "Cryptographic keys found that led to data decryption of PII",
        "Root access exposed cryptographic keys in the app's private directory. These keys successfully decrypted protected user data — the most severe evidence-based finding in this entire assessment."],
    },
  },
  {
    name: "CityFix", agency: "MCP", sector: "citizen",
    status: {
      "PF-01-R01": ["succeeded", "APK decompiled — municipal reporting API revealed",
        "CityFix's APK can potentially be decompiled to expose municipal reporting APIs, user account handling, and location-based service logic."],
      "PF-01-R02": ["succeeded", "Repackaged and runs successfully",
        "The APK was repackaged and runs successfully. A malicious clone could collect users' location data, contact information, and municipal reports."],
      "PF-02-R01": ["succeeded", "Private data directory accessible",
        "The private data directory was accessible. Cached user reports, contact details, and location data could potentially be extracted."],
      "PF-02-R02": ["succeeded", "Runtime logs captured",
        "Runtime logs captured via ADB. Municipal report submissions and user location data may appear in unsanitized log output."],
      "PF-03-R01": ["exposed", "Tokens and Cookies intercepted",
        "Authentication tokens and cookies could potentially be captured via HTTP proxy. These enable session hijacking and unauthorized access to the user's submitted reports, contact details, and account."],
      "PF-04-R01": ["succeeded", "Overlay drawn over interface",
        "A phishing overlay can capture CityFix login credentials, granting access to the user's municipal reports and personal contact information."],
      "PF-05-R01": ["succeeded", "Accessibility Services Enabled, Programmatic UI operations performed",
        "Accessibility services enabled programmatic interactions with municipal reporting screens."],
      "PF-05-R02": ["succeeded", "Accessibility Services Enabled, User activity captured",
        "User interactions with report submission screens could potentially be captured."],
      "PF-05-R03": ["succeeded", "Accessibility Services Enabled, On-screen text extracted",
        "Report details, location information, and personal contact data could potentially be extracted from screen via accessibility."],
      "PF-06-R01": ["succeeded", "Screen recording captured successfully",
        "User reports, location data, and personal information displayed on screen could potentially be captured via screen recording without restriction."],
      "PF-07-R01": ["exposed", "Full root access — no encryption, no detection",
        "On a rooted device, the private data directory was accessible via su shell. No root detection or data-at-rest encryption was present — the widest exposure in this assessment."],
    },
  },
  {
    name: "ParkNow", agency: "NexaTech", sector: "citizen",
    status: {
      "PF-01-R01": ["succeeded", "APK decompiled",
        "ParkNow's APK can potentially be decompiled to expose parking session APIs, vehicle registration handling, and payment processing logic."],
      "PF-01-R02": ["blocked", "Crashes after repackaging"],
      "PF-02-R01": ["succeeded", "Private data directory accessible",
        "The private data directory was accessible. Cached vehicle registration numbers, parking history, and payment method details could potentially be extracted."],
      "PF-02-R02": ["succeeded", "Runtime logs captured",
        "Runtime logs captured via ADB. Parking session data, vehicle registration, and payment API calls may appear in log output."],
      "PF-03-R01": ["blocked", "Non-cancellable alert dialog triggered"],
      "PF-04-R01": ["succeeded", "Overlay drawn over interface",
        "A phishing overlay can capture ParkNow login credentials and payment details entered during parking sessions."],
      "PF-05-R01": ["succeeded", "Accessibility Services Enabled, Programmatic UI operations performed",
        "Accessibility services enabled programmatic interactions with parking session screens."],
      "PF-05-R02": ["succeeded", "User activity captured",
        "User interactions with parking and payment screens could potentially be captured."],
      "PF-05-R03": ["succeeded", "Accessibility Services Enabled, On-screen text extracted",
        "Vehicle registration numbers, parking locations, and payment information could potentially be extracted from screen via accessibility."],
      "PF-06-R01": ["succeeded", "Screen recording captured successfully",
        "Vehicle registration, parking session details, and payment screens could potentially be captured via screen recording without restriction."],
      "PF-07-R01": ["exposed", "Full root access — private data directory accessible",
        "The app ran without restriction on a rooted device with private data directory accessible."],
    },
  },
  {
    name: "TransitOne", agency: "NTA", sector: "citizen",
    status: {
      "PF-01-R01": ["succeeded", "APK decompiled",
        "TransitOne's APK can potentially be decompiled to expose transport service APIs, route planning logic, and location tracking mechanisms."],
      "PF-01-R02": ["blocked", "Crashes after repackaging"],
      "PF-02-R01": ["succeeded", "Private data directory accessible",
        "The private data directory was accessible. Cached travel patterns, saved routes, and location history could potentially be extracted."],
      "PF-02-R02": ["succeeded", "Runtime logs captured",
        "Runtime logs captured via ADB. Transport API calls containing location data and travel patterns may appear in unsanitized output."],
      "PF-03-R01": ["blocked", "Crashes on app launch with proxy"],
      "PF-04-R01": ["succeeded", "Overlay drawn over interface",
        "A phishing overlay can potentially be drawn over TransitOne's interface to capture login credentials or payment details for transport services."],
      "PF-05-R01": ["succeeded", "Accessibility Services Enabled,no programmatic UI operations performed",
        "Accessibility services enabled programmatic interactions with transport service screens."],
      "PF-05-R02": ["succeeded", "Accessibility Services Enabled, no user activity captured",
        "User interactions with route planning and transport screens could potentially be captured."],
      "PF-05-R03": ["succeeded", "Accessibility Services Enabled, On-screen text extracted",
        "Saved routes, travel history, and location-based service details could potentially be extracted from screen via accessibility."],
      "PF-06-R01": ["succeeded", "Screen recording captured successfully",
        "Travel routes, location data, and transport service screens could potentially be captured via screen recording without restriction."],
      "PF-07-R01": ["blocked", "Crashing on rooted device",
        "The app exhibited crashing behavior on rooted device with no access to private data directory."],
    },
  },
  {
    name: "PowerHome", agency: "National Grid Corp", sector: "citizen",
    status: {
      "PF-01-R01": ["succeeded", "APK decompiled ",
        "PowerHome' APK can potentially be decompiled to expose utility billing APIs, EV charging station logic, and payment processing mechanisms."],
      "PF-01-R02": ["succeeded", "Repackaged and runs successfully",
        "The APK was repackaged and runs successfully. A malicious clone could capture utility account credentials, payment information, and residential address data."],
      "PF-02-R01": ["succeeded", "Private data directory accessible",
        "The private data directory was accessible. Cached utility account data, billing history, residential addresses, and payment details could potentially be extracted."],
      "PF-02-R02": ["succeeded", "Runtime logs captured",
        "Runtime logs captured via ADB. Utility billing queries and payment API calls may leak account and address data in unsanitized output."],
      "PF-03-R01": ["blocked", "Non-cancellable alert dialog triggered"],
      "PF-04-R01": ["succeeded", "Overlay drawn over interface",
        "A phishing overlay can capture National Grid login credentials and payment details, granting access to utility accounts and residential address information."],
      "PF-05-R01": ["succeeded", "Accessibility Services Enabled, Programmatic UI operations performed",
        "Accessibility services enabled programmatic UI operations on billing and payment screens."],
      "PF-05-R02": ["succeeded", "Accessibility Services Enabled, no user activity captured",
        "User interactions with utility billing and payment screens could potentially be captured."],
      "PF-05-R03": ["exposed", "Accessibility Services Enabled, On-screen text extracted",
        "On-screen text extracted — which may including utility billing amounts, account details, and residential address information."],
      "PF-06-R01": ["succeeded", "Screen recording captured successfully",
        "Utility billing screens, payment details, residential address, and EV charging data could potentially be captured via screen recording without restriction."],
      "PF-07-R01": ["succeeded", "Disallowed runtime on rooted device, but private data directory was accessible "],
    },
  },
];

// ── SECTORS ─────────────────────────────────────────────────────────────────

const sectors = [
  {
    id: "identity", name: "National Digital Identity", color: "#dc2626",
    insight: "Despite having 5/11 gaps — tied with PensionGo as best defended in the assessment — accessibility services captured actual SecurePass login credentials (national ID and password) at the login page. As the gateway to all platform services, this single exposure grants cascading access to financial, health, immigration, and citizen service accounts.",
    finding: "national ID + Password captured via accessibility at SecurePass login",
  },
  {
    id: "financial", name: "Financial", color: "#f59e0b",
    insight: "PensionGo has 5/11 gaps with 6 risks blocked — the strongest defense posture in this assessment. All 3 accessibility abuse vectors (PF-05) are blocked. However, a malicious overlay was drawn over the login interface, the private data directory was accessible via debuggable repackaging, and screen recording displayed a warning but content could potentially be captured. A credential theft on pension accounts could expose citizens' retirement savings.",
    finding: "Overlay drawn over PensionGo — fake login screen could capture pension credentials",
  },
  {
    id: "healthcare", name: "Healthcare", color: "#dc2626",
    insight: "Health 123 has 10/11 gaps — session tokens were intercepted, root access exposed the private data directory, and health data was scraped via accessibility. On-screen medical data was confirmed scraped across all three healthcare apps via accessibility services. Medical record breaches are irreversible — diagnoses, prescriptions, and screening results cannot be changed like passwords.",
    finding: "Auth tokens intercepted on Health 123; medical records scraped via accessibility across all 3 apps",
  },
  {
    id: "immigration", name: "Immigration & Border", color: "#dc2626",
    insight: "MyBorderPass has 10/11 gaps — only traffic interception was blocked. The APK was successfully repackaged into a functional running clone. On-screen passport details, visa status, and immigration records were scraped via accessibility services. Border and identity data faces near-complete exposure.",
    finding: "MyBorderPass APK repackaged and runs — passport data scraped via accessibility",
  },
  {
    id: "workforce", name: "Workforce", color: "#dc2626",
    insight: "WorkID Plus (8/11 gaps) detects USB debugging and app tampering but allows overlay phishing and all three accessibility abuse vectors — work permit details were confirmed scraped from screen. MigraCare (10/11 gaps) can be repackaged into a functional clone, and worker identity data was captured via accessibility, targeting a population less likely to detect a fake app.",
    finding: "MigraCare repackageable; work permit and worker identity data exposed via accessibility",
  },
  {
    id: "citizen", name: "Citizen Services", color: "#dc2626",
    insight: "CityFix has 11/11 gaps — maximum risk with zero defenses confirmed. CitizenX root access exposed cryptographic keys that successfully decrypted user data — the most severe evidence-based finding in this assessment. Authentication tokens were confirmed intercepted on both CitizenX and CityFix. Across 5 apps, all 5 critical risks are unblocked.",
    finding: "CitizenX: crypto keys extracted via root — data decrypted. CityFix: zero defenses (11/11).",
  },
];

// ── HELPERS ─────────────────────────────────────────────────────────────────

const getWeightedScore = (app) => {
  let score = 0;
  for (const risk of risks) {
    const [status] = app.status[risk.id];
    if (status !== "blocked") score++;
  }
  return score;
};

const scoreColor = (score) => score <= 3 ? "#059669" : score <= 7 ? "#f59e0b" : "#dc2626";
const STATUS_COLORS = { blocked: "#9ca3af", succeeded: "#dc2626", exposed: "#dc2626" };
const STATUS_ICONS = { blocked: "\u2713", succeeded: "\u26A0", exposed: "\u26A0" };
const STATUS_BG = { blocked: "#dcfce7", succeeded: "#fef3c7", exposed: "#fee2e2" };
const SEV = { Critical: "#dc2626", High: "#f59e0b" };

// ── STATISTICS HELPERS ──────────────────────────────────────────────────────


// ── PEER PRESSURE MATRIX — executive asks per control ───────────────────────


// ── SECTOR BAR CHART (Recharts) ──────────────────────────────────────────────

// ── DASHBOARD ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [tab, setTab] = useState("deepdive");
  const [ddView, setDdView] = useState(0); // 0 = L1-Main (bar chart + app list), 1 = L1-Side (diverging + outliers)
  const [rankView, setRankView] = useState("bar");
  const [hoveredDot, setHoveredDot] = useState(null);
  const [expandedOutlier, setExpandedOutlier] = useState(null);
  const [hoveredOutlierRisk, setHoveredOutlierRisk] = useState(null);
  const [pinnedOutlierRisk, setPinnedOutlierRisk] = useState(null);
  const [ddExpandedApp, setDdExpandedApp] = useState(null);
  const [ddExpandedRisk, setDdExpandedRisk] = useState(null);
  const [hoveredApp, setHoveredApp] = useState(null);
  const [emailModal, setEmailModal] = useState(null);
  const [ddSelectedRisk, setDdSelectedRisk] = useState({}); // { [appName]: riskId }
  const [outlierEmailModal, setOutlierEmailModal] = useState(null); // { riskId, title, apps: [...], selected: Set }
  const [, setDataVersion] = useState(0);
  const [dashboardLoadState, setDashboardLoadState] = useState("loading");
  const [dashboardLoadError, setDashboardLoadError] = useState("");

  const readFileAsBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        const commaIdx = result.indexOf(",");
        resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
      };
      reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

  const normalizePlatformFeatureInput = (rawValue) => {
    const raw = String(rawValue || "").trim().toLowerCase();
    if (!raw) return "";
    let match = raw.match(/^pf[-_ ]?(\d{1,2})$/i);
    if (!match) {
      match = raw.match(/^platform[-_ ]feature[-_ ](\d{1,2})$/i);
    }
    if (!match) return "";
    return `PF-${String(Number(match[1])).padStart(2, "0")}`;
  };

  const normalizeRiskInput = (pfRawValue, riskRawValue) => {
    const normalizedPf = normalizePlatformFeatureInput(pfRawValue);
    const raw = String(riskRawValue || "").trim().toLowerCase();
    if (!raw) return "";

    let match = raw.match(/^pf[-_ ]?(\d{1,2})[-_ ]r(?:isk[-_ ]?)?(\d{1,2})$/i);
    if (match) {
      const pf = `PF-${String(Number(match[1])).padStart(2, "0")}`;
      const riskIdx = String(Number(match[2])).padStart(2, "0");
      return `${pf}-R${riskIdx}`;
    }

    match = raw.match(/^platform[-_ ]feature[-_ ](\d{1,2})[-_ ]risk[-_ ](\d{1,2})$/i);
    if (match) {
      const pf = `PF-${String(Number(match[1])).padStart(2, "0")}`;
      const riskIdx = String(Number(match[2])).padStart(2, "0");
      return `${pf}-R${riskIdx}`;
    }

    match = raw.match(/^r(?:isk[-_ ]?)?(\d{1,2})$/i) || raw.match(/^(\d{1,2})$/i);
    if (match && normalizedPf) {
      const riskIdx = String(Number(match[1])).padStart(2, "0");
      return `${normalizedPf}-R${riskIdx}`;
    }

    return "";
  };

  const createPocDraft = (contact = {}) => ({
    key: `poc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: String(contact.name || ""),
    number: String(contact.number || ""),
    email: String(contact.email || ""),
  });

  // Add Findings form state
  const [afAppName, setAfAppName] = useState("");
  const [afAppAgency, setAfAppAgency] = useState("");
  const [afAppVersion, setAfAppVersion] = useState("");
  const [afSectorId, setAfSectorId] = useState(() => sectors[0]?.id || "");
  const [afPointOfContacts, setAfPointOfContacts] = useState(() => [createPocDraft()]);
  const [afRiskStatus, setAfRiskStatus] = useState({}); // { [riskId]: "at-risk" | "not-at-risk" | null }
  const [afObservations, setAfObservations] = useState({}); // { [riskId]: Set of selected observations }
  const [afDemoFile, setAfDemoFile] = useState(null);
  const [afSubmitted, setAfSubmitted] = useState(false);

  // Add Platform Feature / Risk form state
  const [apfId, setApfId] = useState("");
  const [apfDescription, setApfDescription] = useState("");
  const [apfAdditionalContext, setApfAdditionalContext] = useState("");
  const [apfDemoFile, setApfDemoFile] = useState(null);
  const [apfSubmitted, setApfSubmitted] = useState(false);
  const [riskDrafts, setRiskDrafts] = useState([]);
  const [selectedPf, setSelectedPf] = useState(null);
  const afPrefilledAppNameRef = React.useRef(null);

  const createRiskDraft = () => ({
    key: `risk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    riskId: "",
    description: "",
    demoFile: null,
    atRiskObservationsText: "",
    notAtRiskObservationsText: "",
  });

  useEffect(() => {
    let isActive = true;

    const loadDashboardData = async () => {
      setDashboardLoadState("loading");
      setDashboardLoadError("");

      const endpoints = [
        "/api/dashboard-data",
        "http://127.0.0.1:8787/api/dashboard-data",
        "http://localhost:8787/api/dashboard-data",
      ];

      let lastError = null;
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint);
          if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
          }
          const payload = await response.json();
          if (!isActive) return;
          applyDashboardData(payload);
          setDataVersion((v) => v + 1);
          setDashboardLoadState("ready");
          return;
        } catch (error) {
          lastError = error;
        }
      }

      if (!isActive) return;
      setDashboardLoadState("error");
      setDashboardLoadError(lastError?.message || "Failed to load dashboard data");
      console.error("Unable to load live dashboard data:", lastError);
    };

    loadDashboardData();
    return () => {
      isActive = false;
    };
  }, []);

  // Deep Dive section observer: keeps dot rail synced with visible section.
  useEffect(() => {
    if (tab !== "deepdive") return undefined;

    const sections = [0, 1]
      .map((idx) => ({ idx, el: document.getElementById(`dd-section-${idx}`) }))
      .filter((item) => item.el);
    if (sections.length === 0) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        let best = null;
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const idx = Number(entry.target.getAttribute("data-dd-index"));
          if (Number.isNaN(idx)) return;
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { idx, ratio: entry.intersectionRatio };
          }
        });
        if (best) setDdView(best.idx);
      },
      {
        threshold: [0.4, 0.6, 0.8],
      }
    );

    sections.forEach(({ idx, el }) => {
      el.setAttribute("data-dd-index", String(idx));
      observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [tab]);

  // Helper to get guide description + goal from riskConsequences (strip curly braces)
  const getGuideText = (riskId) => {
    const text = riskConsequences[riskId];
    if (!text) return { description: "", goal: "" };
    const lines = text.split("\n");
    const description = (lines[0] || "").replace(/\{([^}]+)\}/g, "$1");
    const goal = (lines[1] || "").replace(/\{([^}]+)\}/g, (_, inner) => {
      const dashIdx = inner.indexOf(" \u2014 ");
      return dashIdx !== -1 ? inner.slice(dashIdx + 3) : inner;
    });
    return { description, goal };
  };

  // Helper to derive document name from risk ID (PF-01-R01 → platform-feature-01-risk-01)
  const getDocName = (riskId) => {
    const parts = riskId.match(/PF-(\d+)-R(\d+)/);
    if (!parts) return riskId;
    return `platform-feature-${parts[1]}-risk-${parts[2]}`;
  };

  const buildEmail = (app, singleRisk) => {
    const targetRisks = singleRisk ? [singleRisk] : risks.filter(r => app.status[r.id][0] !== "blocked");
    const subject = `Security Observation for ${app.name} \u2013 Attention Required`;

    const riskSections = targetRisks.map(r => {
      const obs = riskObservations[r.id]?.[app.name] || "";
      const guide = getGuideText(r.id);
      const control = riskControls[r.id] || "";
      const docBase = getDocName(r.id);
      return [
        `What is the observation?`,
        ``,
        obs,
        ``,
        guide.description,
        guide.goal,
        ``,
        `We have attached the document ${docBase}.pdf with detailed instructions to reproduce this observation.`,
        ``,
        `What can be done better?`,
        ``,
        `${app.name} ${control} by taking actionable steps outlined in the attached document ${docBase}-control-01.pdf.`,
      ].join("\n");
    });

    const lines = [
      `Dear Sir/Madam,`,
      ``,
      `As part of our regular mobile app security testing, we have identified a security observation related to your Android mobile application, ${app.name}, that requires your attention. Below is a detailed overview of the observation and recommended next steps.`,
      ``,
      ...riskSections.flatMap((section, i) => i > 0 ? [``, `---`, ``, section] : [section]),
      ``,
      `What are the next steps?`,
      ``,
      `We'd appreciate it if you could confirm whether the observation is accurate. If it is, could you kindly let us know if the remediation actions have been applied? If not, we'd be grateful if you could share any alternative steps you've taken.`,
      ``,
      `Finally, if you need any further clarification or would like to discuss this in more detail, we'd be more than happy to hop on a call at your convenience.`,
      ``,
      `Thank you so much for your attention to this and we look forward to hearing from you.`,
      ``,
      `Best regards,`,
      `[Your Full Name]`,
      `[Your Job Title]`,
      `[Your Company Name]`,
      `[Your Contact Information]`,
    ];
    return { subject, body: lines.join("\n") };
  };

  const buildOutlierEmail = (riskTitle, riskId, selectedAppsInput) => {
    const risk = risks.find(r => r.id === riskId) || risks.find(r => riskId.startsWith(r.id));
    const effectiveRiskId = risk?.id || riskId;
    const selectedApps = Array.isArray(selectedAppsInput)
      ? selectedAppsInput
      : selectedAppsInput
        ? [selectedAppsInput]
        : [];
    const singleApp = selectedApps.length === 1 ? selectedApps[0] : null;
    const agencies = [...new Set(selectedApps.map(a => a.agency).filter(Boolean))];
    const appName = singleApp ? singleApp.name : "your agency app";

    const subject = `Security Observation for ${appName} \u2013 Attention Required`;

    const obs = singleApp
      ? riskObservations[riskId]?.[singleApp.name] || riskObservations[effectiveRiskId]?.[singleApp.name] || ""
      : "";
    const guide = getGuideText(effectiveRiskId);
    const control = riskControls[effectiveRiskId] || "";
    const docBase = getDocName(effectiveRiskId);

    const lines = [
      `Dear Sir/Madam,`,
      ``,
      `As part of our regular mobile app security testing, we have identified a security observation related to your Android mobile application, ${appName}, that requires your attention. Below is a detailed overview of the observation and recommended next steps.`,
      ``,
      `What is the observation?`,
      ``,
      obs,
      ``,
      guide.description,
      guide.goal,
      ``,
      `We have attached the document ${docBase}.pdf with detailed instructions to reproduce this observation.`,
      ``,
      `What can be done better?`,
      ``,
      `${appName} ${control} by taking actionable steps outlined in the attached document ${docBase}-control-01.pdf.`,
      ``,
      `What are the next steps?`,
      ``,
      `We'd appreciate it if you could confirm whether the observation is accurate. If it is, could you kindly let us know if the remediation actions have been applied? If not, we'd be grateful if you could share any alternative steps you've taken.`,
      ``,
      `Finally, if you need any further clarification or would like to discuss this in more detail, we'd be more than happy to hop on a call at your convenience.`,
      ``,
      `Thank you so much for your attention to this and we look forward to hearing from you.`,
      ``,
      `Best regards,`,
      `[Your Full Name]`,
      `[Your Job Title]`,
      `[Your Company Name]`,
      `[Your Contact Information]`,
    ];
    return {
      subject,
      body: lines.join("\n"),
      to: agencies.length ? agencies.map(agency => `CISO, ${agency}`).join("; ") : "No agency selected",
    };
  };

  const sortedByRisk = [...apps].sort((a, b) => getWeightedScore(b) - getWeightedScore(a));
  const totalApps = apps.length;
  const totalRisks = risks.length;
  const totalPlatformFeatures = new Set(risks.map((risk) => risk.pf)).size;
  const safeTotalApps = Math.max(totalApps, 1);
  const safeTotalRisks = Math.max(totalRisks, 1);
  const scoreAxisTicks = [...new Set([0, Math.min(3, safeTotalRisks), Math.min(7, safeTotalRisks), safeTotalRisks])];
  const bestDefendedScore = Math.min(5, safeTotalRisks);
  const getAppVersion = (appOrName) => {
    if (!appOrName) return null;
    if (typeof appOrName === "object") return appOrName.appVersion || null;
    return apps.find((app) => app.name === appOrName)?.appVersion || null;
  };
  const existingAppMatch = apps.find((app) => app.name.toLowerCase() === afAppName.trim().toLowerCase()) || null;
  const pendingAssessmentRiskIds = new Set(
    existingAppMatch
      ? risks
          .filter((risk) => {
            const existingStatus = existingAppMatch.status[risk.id];
            return !existingStatus || existingStatus[1] === "Pending assessment";
          })
          .map((risk) => risk.id)
      : []
  );
  const isRiskAssessmentPending = (app, riskId) => {
    const statusTuple = app.status[riskId];
    return !statusTuple || statusTuple[1] === "Pending assessment";
  };
  const deepDiveChartRisks = risks
    .filter((risk) => apps.every((app) => !isRiskAssessmentPending(app, risk.id)))
    .map((risk) => ({
      ...risk,
      blockedApps: apps.filter((app) => app.status[risk.id][0] === "blocked"),
      atRiskApps: apps.filter((app) => app.status[risk.id][0] !== "blocked"),
    }))
    .map((risk) => ({
      ...risk,
      blocked: risk.blockedApps.length,
      affected: risk.atRiskApps.length,
    }))
    .sort((a, b) => b.affected - a.affected);

  useEffect(() => {
    if (!existingAppMatch) {
      afPrefilledAppNameRef.current = null;
      return;
    }
    if (afPrefilledAppNameRef.current === existingAppMatch.name) return;

    afPrefilledAppNameRef.current = existingAppMatch.name;
    setAfAppAgency(existingAppMatch.agency || "");
    setAfAppVersion(existingAppMatch.appVersion || "");
    setAfSectorId(existingAppMatch.sector || sectors[0]?.id || "");
    const nextContacts = (existingAppMatch.pointOfContacts && existingAppMatch.pointOfContacts.length > 0
      ? existingAppMatch.pointOfContacts
      : existingAppMatch.pointOfContact && (existingAppMatch.pointOfContact.name || existingAppMatch.pointOfContact.number || existingAppMatch.pointOfContact.email)
        ? [existingAppMatch.pointOfContact]
        : [])
      .map((contact) => createPocDraft(contact));
    setAfPointOfContacts(nextContacts.length > 0 ? nextContacts : [createPocDraft()]);

    const nextRiskStatus = {};
    risks.forEach((risk) => {
      const existingStatus = existingAppMatch.status[risk.id];
      if (!existingStatus || existingStatus[1] === "Pending assessment") return;
      nextRiskStatus[risk.id] = existingStatus[0] === "blocked" ? "not-at-risk" : "at-risk";
    });
    setAfRiskStatus(nextRiskStatus);

    const nextObservations = {};
    risks.forEach((risk) => {
      nextObservations[risk.id] = new Set();
    });
    setAfObservations(nextObservations);
  }, [existingAppMatch]);

  const tabStyle = (t) => ({
    padding: "12px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer",
    borderRadius: "6px 6px 0 0", border: "none",
    background: tab === t ? "#f0f2f5" : "transparent",
    color: tab === t ? "#111827" : "#94a3b8",
    borderBottom: tab === t ? "3px solid #fff" : "3px solid transparent",
  });
  const deepDiveChartLabelWidth = 230;
  const deepDiveChartRowHeight = 32;
  const deepDiveVisibleRiskCount = deepDiveChartRisks.length;
  const deepDivePendingRiskCount = Math.max(totalRisks - deepDiveVisibleRiskCount, 0);

  const resetAddFindingsForm = () => {
    afPrefilledAppNameRef.current = null;
    setAfSubmitted(false);
    setAfAppName("");
    setAfAppAgency("");
    setAfAppVersion("");
    setAfSectorId(sectors[0]?.id || "");
    setAfPointOfContacts([createPocDraft()]);
    setAfRiskStatus({});
    setAfObservations({});
    setAfDemoFile(null);
  };

  if (dashboardLoadState === "loading") {
    return (
      <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#f0f2f5", minHeight: "100vh", color: "#111827", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ width: "100%", maxWidth: 560, background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 8px 32px rgba(15,23,42,0.08)", padding: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            Android Risk Assessment
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
            Loading live dashboard data
          </div>
          <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
            Waiting for `/api/dashboard-data` so the dashboard renders from the database instead of the in-file fallback dataset.
          </div>
        </div>
      </div>
    );
  }

  if (dashboardLoadState === "error") {
    return (
      <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#f0f2f5", minHeight: "100vh", color: "#111827", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ width: "100%", maxWidth: 620, background: "#fff", borderRadius: 16, border: "1px solid #fecaca", boxShadow: "0 8px 32px rgba(15,23,42,0.08)", padding: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            Live Data Unavailable
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
            The dashboard could not load from the API
          </div>
          <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, marginBottom: 14 }}>
            The frontend is intentionally refusing to use the stale in-file fallback dataset.
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#991b1b", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: 12 }}>
            {dashboardLoadError || "Unknown API error"}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 18, padding: "10px 16px", borderRadius: 10, border: "1px solid #0f172a", background: "#0f172a", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#f0f2f5", minHeight: "100vh", color: "#111827" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* ── HEADER ── */}
      <div style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)", color: "#fff" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 40px 0" }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
              App Ecosystem · Android Platform Security
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-0.02em", color: "#f1f5f9" }}>
              Android Risk Assessment
            </h1>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
              {totalApps} apps across {sectors.length} sectors — we are looking at {totalPlatformFeatures} android features that yields {totalRisks} risks
            </div>
          </div>

          {/* ── P1 KPI STRIP ── */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
            gap: 1, background: "#0f172a", borderRadius: "12px 12px 0 0",
            marginTop: 24, overflow: "hidden",
          }}>
            {[
              {
                label: "Apps",
                hero: String(totalApps),
                heroSize: 48,
                sub: "mobile applications assessed",
                heroColor: "#f1f5f9",
              },
              {
                label: "Sectors",
                hero: String(sectors.length),
                heroSize: 48,
                sub: "sectors covered",
                heroColor: "#fde68a",
              },
              {
                label: "Android Features",
                hero: String(totalPlatformFeatures),
                heroSize: 48,
                sub: "platform features examined",
                heroColor: "#93c5fd",
              },
              {
                label: "Risks",
                hero: String(totalRisks),
                heroSize: 48,
                sub: "risks derived from features",
                heroColor: "#fca5a5",
              },
            ].map((kpi, i) => (
              <div key={i} style={{ background: "#1e293b", padding: "28px 24px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                  {kpi.label}
                </div>
                <div style={{ fontSize: kpi.heroSize, fontWeight: 800, color: kpi.heroColor, lineHeight: 1.1, marginBottom: 8 }}>
                  {kpi.hero}
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{kpi.sub}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginTop: 0 }}>
            <button onClick={() => setTab("deepdive")} style={tabStyle("deepdive")}>Deep Dive</button>
            <button onClick={() => setTab("addfindings")} style={tabStyle("addfindings")}>Findings</button>
            <button onClick={() => setTab("addrisk")} style={tabStyle("addrisk")}>Platform Features / Risks</button>
          </div>
        </div>
      </div>

      <div id="dd-content-area" style={{ padding: "32px 40px", maxWidth: 1280, margin: "0 auto" }}>

        {/* ── TAB: DEEP DIVE (single-column, original layout) ── */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {tab === "deepdive" && (() => {
          const systemicGaps = deepDiveChartRisks;

          const rankingData = sortedByRisk.map(app => ({
            name: app.name,
            appVersion: app.appVersion || null,
            score: getWeightedScore(app),
          }));
          const activeOutlierRisk = pinnedOutlierRisk || hoveredOutlierRisk;
          const highlightedOutlierRiskIds = activeOutlierRisk === "PF-05-R01/02/03"
            ? ["PF-05-R01", "PF-05-R02", "PF-05-R03"]
            : activeOutlierRisk
              ? [activeOutlierRisk]
              : [];

          return (
            <>
              <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 24 }}>
                Analytical breakdown across all {totalApps} apps, {totalRisks} risks, and {sectors.length} sectors.
              </div>

              {/* Vertical carousel wrapper */}
              <div style={{ display: "flex", gap: 16 }}>

              {/* Vertical dot rail — left side */}
              <div style={{ position: "sticky", top: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, alignSelf: "flex-start", paddingTop: 300 }}>
                {[0, 1].map(i => (
                  <button key={i}
                    onClick={() => {
                      setDdView(i);
                      document.getElementById(`dd-section-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    title={i === 0 ? "How's Android mobile apps doing?" : "What can Android mobile apps do better?"}
                    style={{
                      width: ddView === i ? 12 : 10,
                      height: ddView === i ? 12 : 10,
                      borderRadius: "50%",
                      border: "none",
                      background: ddView === i ? "#111827" : "#d1d5db",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      padding: 0,
                      boxShadow: ddView === i ? "0 0 0 3px #11182720" : "none",
                    }}
                  />
                ))}
              </div>

              {/* Main content area */}
              <div style={{ flex: 1, minWidth: 0 }}>

              <div id="dd-section-0" style={{ display: "grid", gridTemplateColumns: "7fr 3fr", gap: 24 }}>

                {/* ── LEFT COLUMN (70%) ── */}
                <div>

                  {/* How's Android mobile apps doing? */}
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 12 }}>How's Android mobile apps doing?</div>
              <div style={{ background: "#fff", borderRadius: 16, padding: "24px 28px", border: "1px solid #e5e7eb", marginBottom: 32, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>
                    {rankView === "bar" ? "Ranked worst to best" : "Each dot = one app · position shows gap score · hover to identify"}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[["bar", "Bar Chart"], ["dot", "Dot Plot"]].map(([v, label]) => (
                      <button key={v} onClick={() => setRankView(v)} style={{
                        padding: "5px 14px", fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: "pointer",
                        border: "1.5px solid #e5e7eb",
                        background: rankView === v ? "#111827" : "#fff",
                        color: rankView === v ? "#fff" : "#6b7280",
                      }}>{label}</button>
                    ))}
                  </div>
                </div>
                {rankView === "bar" ? (
                  <ResponsiveContainer width="100%" height={520}>
                    <BarChart data={rankingData} layout="vertical" margin={{ top: 20, right: 140, left: 0, bottom: 0 }} barSize={22}>
                      <XAxis type="number" domain={[0, totalRisks]} ticks={scoreAxisTicks} tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v} Risks`} />
                      <ReferenceLine x={5} stroke="#6b7280" strokeDasharray="6 3" strokeWidth={1.5} label={({ viewBox }) => (<text x={viewBox.x} y={viewBox.y - 6} textAnchor="middle" fontSize={11} fontWeight={800} fill="#374151">Desired Outcome</text>)} />
                      <Tooltip contentStyle={{ fontSize: 13, borderRadius: 8, border: "1px solid #e5e7eb" }} formatter={(v) => [`${v} / ${totalRisks} gaps`, "Risk Score"]} />
                      <YAxis type="category" dataKey="name" width={110} axisLine={false} tickLine={false}
                        tick={({ x, y, payload }) => {
                          const appVersion = rankingData.find((entry) => entry.name === payload.value)?.appVersion || null;
                          const isDimmed = hoveredApp && hoveredApp !== payload.value;
                          return (
                          <text x={x} y={y} textAnchor="end" dy={4} fontSize={13} fontWeight={600}
                            fill={isDimmed ? "#d1d5db" : "#374151"}
                            style={{ transition: "fill 0.15s" }}>
                            <tspan>{payload.value}</tspan>
                            {appVersion && <tspan dx={4} fontSize={10} fontWeight={500} fill={isDimmed ? "#e5e7eb" : "#9ca3af"}>v{appVersion}</tspan>}
                          </text>
                          );
                        }}
                      />
                      <Bar dataKey="score" radius={[0, 6, 6, 0]}
                        onMouseEnter={(data) => setHoveredApp(data.name)}
                        onMouseLeave={() => setHoveredApp(null)}
                        onClick={(data) => { setDdExpandedApp(data.name); setDdExpandedRisk(null); }}
                        label={({ x, y, width, height, value, index }) => {
                          const entry = rankingData[index];
                          const dimmed = hoveredApp && hoveredApp !== entry?.name;
                          return (
                            <text
                              x={x + width + 10}
                              y={y + height / 2}
                              dy={5}
                              fontSize={13}
                              fontWeight={700}
                              fill={dimmed ? "#d1d5db" : "#374151"}
                              textAnchor="start"
                            >
                              {value}/{totalRisks} Risks
                            </text>
                          );
                        }}
                      >
                        {rankingData.map((entry, i) => (
                          <Cell key={i}
                            fill={hoveredApp && hoveredApp !== entry.name ? "#e5e7eb" : scoreColor(entry.score)}
                            opacity={hoveredApp && hoveredApp !== entry.name ? 0.5 : 1}
                            style={{ cursor: "pointer" }}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (() => {
                  const AXIS_Y = 110; const STEP = 30; const X_MIN = 6; const X_MAX = 94;
                  const byScore = {};
                  sortedByRisk.forEach(app => { const sc = getWeightedScore(app); if (!byScore[sc]) byScore[sc] = []; byScore[sc].push(app); });
                  const dotPos = [];
                  Object.entries(byScore).forEach(([scStr, appsAtScore]) => {
                    const sc = parseInt(scStr);
                    const xPct = X_MIN + (sc / safeTotalRisks) * (X_MAX - X_MIN);
                    appsAtScore.forEach((app, idx) => {
                      const above = idx % 2 === 0;
                      const level = Math.floor(idx / 2) + 1;
                      dotPos.push({ app, sc, xPct, dotY: AXIS_Y + (above ? -level * STEP : level * STEP), above });
                    });
                  });
                  const scoreGroups = Object.entries(byScore).sort((a, b) => parseInt(b[0]) - parseInt(a[0]));
                  const bestDefendedX = X_MIN + (bestDefendedScore / safeTotalRisks) * (X_MAX - X_MIN);
                  return (
                    <>
                      <div style={{ position: "relative", height: 220, borderRadius: 8, overflow: "hidden", background: "#fafafa" }}>
                        {/* Best Defended line at 5/11 */}
                        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${bestDefendedX}%`, borderLeft: "2px dashed #6b7280" }} />
                        <div style={{ position: "absolute", top: 6, left: `${bestDefendedX + 0.5}%`, fontSize: 9, fontWeight: 800, color: "#6b7280", whiteSpace: "nowrap" }}>
                          Best Defended <span style={{ fontWeight: 400, color: "#9ca3af" }}>(HOVER TO VIEW)</span>
                        </div>
                        {/* X axis line + numeric ticks 0–11 */}
                        <div style={{ position: "absolute", top: AXIS_Y, left: `${X_MIN}%`, right: `${100-X_MAX}%`, height: 2, background: "#d1d5db" }} />
                        {Array.from({ length: safeTotalRisks + 1 }, (_, tick) => tick).map(tick => {
                          const lp = X_MIN + (tick / safeTotalRisks) * (X_MAX - X_MIN);
                          return (
                            <React.Fragment key={tick}>
                              <div style={{ position: "absolute", top: AXIS_Y - 2, left: `${lp}%`, transform: "translateX(-50%)", width: 1, height: 6, background: "#c0c4cc" }} />
                              <div style={{ position: "absolute", top: AXIS_Y + 7, left: `${lp}%`, transform: "translateX(-50%)", fontSize: 10, fontWeight: 600, color: "#9ca3af" }}>{tick}</div>
                            </React.Fragment>
                          );
                        })}
                        {dotPos.map(({ app, sc, xPct, dotY, above }) => {
                          const isActive = hoveredApp === app.name;
                          const isDimmed = hoveredApp && !isActive;
                          const baseColor = scoreColor(sc);
                          const dotColor = isDimmed ? "#d1d5db" : baseColor;
                          return (
                            <React.Fragment key={app.name}>
                              <div style={{ position: "absolute", left: `${xPct}%`, top: above ? dotY+8 : AXIS_Y, width: 1, height: above ? AXIS_Y-dotY-8 : dotY-8-AXIS_Y, background: isDimmed ? "#e5e7eb" : `${baseColor}45`, transform: "translateX(-50%)", transition: "background 0.15s" }} />
                              <div
                                onMouseEnter={() => { setHoveredApp(app.name); setHoveredDot({ name: app.name, appVersion: app.appVersion || null, sc, xPct, dotY }); }}
                                onMouseLeave={() => { setHoveredApp(null); setHoveredDot(null); }}
                                onClick={() => { setDdExpandedApp(app.name); setDdExpandedRisk(null); }}
                                style={{ position: "absolute", left: `${xPct}%`, top: dotY, transform: "translate(-50%,-50%)", width: isActive ? 22 : 16, height: isActive ? 22 : 16, borderRadius: "50%", background: dotColor, border: `${isActive ? 3 : 2.5}px solid #fff`, boxShadow: isActive ? `0 0 0 3px ${baseColor}30, 0 2px 10px ${baseColor}80` : isDimmed ? "none" : `0 2px 6px ${baseColor}70`, zIndex: isActive ? 6 : 3, cursor: "pointer", opacity: isDimmed ? 0.35 : 1, transition: "all 0.15s" }} />
                            </React.Fragment>
                          );
                        })}
                        {hoveredDot && (
                          <div style={{ position: "absolute", left: `${hoveredDot.xPct}%`, top: hoveredDot.dotY < 80 ? hoveredDot.dotY+22 : hoveredDot.dotY-58, transform: "translateX(-50%)", background: "#0f172a", color: "#fff", padding: "7px 13px", borderRadius: 8, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", zIndex: 10, boxShadow: "0 4px 14px rgba(0,0,0,0.28)", pointerEvents: "none" }}>
                            <span>{hoveredDot.name}</span>
                            {hoveredDot.appVersion && <span style={{ fontSize: 11, fontWeight: 500, color: "#cbd5e1", marginLeft: 6 }}>v{hoveredDot.appVersion}</span>}
                            <span style={{ display: "block", fontSize: 12, fontWeight: 400, color: "#94a3b8", marginTop: 2 }}>{hoveredDot.sc} / {totalRisks} Risks</span>
                          </div>
                        )}
                      </div>
                      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #f3f4f6" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Score breakdown</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "7px 32px" }}>
                          {scoreGroups.map(([scStr, appsAtScore]) => {
                            const sc = parseInt(scStr);
                            const color = scoreColor(sc);
                            return (
                              <div key={sc} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                                <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0, position: "relative", top: 1 }} />
                                <div style={{ lineHeight: 1.4 }}>
                                  <span style={{ fontSize: 13, fontWeight: 800, color, fontFamily: "'JetBrains Mono', monospace" }}>{sc}/{totalRisks} Risks</span>
                                  <span style={{ fontSize: 12, color: "#6b7280" }}> — {appsAtScore.map(a => a.appVersion ? `${a.name} (v${a.appVersion})` : a.name).join(" · ")}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

                </div>{/* end left column */}

                {/* ── RIGHT COLUMN (30%) — App findings (click bar to populate) ── */}
                <div style={{ display: "flex", flexDirection: "column", height: 0, minHeight: "100%", overflow: "hidden" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 12, flexShrink: 0 }}>
                    All Apps
                    <span style={{ fontSize: 12, fontWeight: 400, color: "#9ca3af", marginLeft: 8 }}>
                      {ddExpandedApp ? (
                        <>
                          <span>{ddExpandedApp}</span>
                          {getAppVersion(ddExpandedApp) && <span style={{ fontSize: 10, marginLeft: 6 }}>v{getAppVersion(ddExpandedApp)}</span>}
                        </>
                      ) : `${totalApps} · click chart to view`}
                    </span>
                  </div>
                  <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", flex: 1, display: "flex", flexDirection: "column", minHeight: 0, marginBottom: 32 }}>
                    {!ddExpandedApp ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, minHeight: 200, padding: 32, textAlign: "center" }}>
                        <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>←</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#9ca3af", lineHeight: 1.6 }}>
                          Click on an app in the chart to view its risk findings
                        </div>
                      </div>
                    ) : (() => {
                      const app = sortedByRisk.find(a => a.name === ddExpandedApp);
                      if (!app) return null;
                      const score = getWeightedScore(app);
                      return (
                        <>
                          {/* Scrollable content */}
                          <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                          {/* App header */}
                          <div style={{ padding: "14px 16px", background: "#fafafa", borderBottom: "1px solid #e5e7eb" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                                  <span>{app.name}</span>
                                  {app.appVersion && <span style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af", marginLeft: 6 }}>v{app.appVersion}</span>}
                                </div>
                                <div style={{ fontSize: 11, color: "#9ca3af" }}>{app.agency}</div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ textAlign: "right", flexShrink: 0 }}>
                                  <div style={{ fontSize: 22, fontWeight: 800, color: scoreColor(score), lineHeight: 1 }}>
                                    {score}<span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400 }}>/ {totalRisks}</span>
                                  </div>
                                </div>
                                <button onClick={() => { setDdExpandedApp(null); setDdExpandedRisk(null); }}
                                  style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "2px 8px", fontSize: 12, color: "#9ca3af", cursor: "pointer", flexShrink: 0 }}>✕</button>
                              </div>
                            </div>
                            <div style={{ height: 5, background: "#e5e7eb", borderRadius: 3, overflow: "hidden", marginTop: 8 }}>
                              <div style={{ width: `${(score / safeTotalRisks) * 100}%`, height: "100%", background: scoreColor(score), borderRadius: 3 }} />
                            </div>
                            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 5 }}>{score}/{totalRisks} risks unblocked</div>
                          </div>
                          {/* All risks listed */}
                          {risks.map((risk, i) => {
                            const [status] = app.status[risk.id];
                            const riskKey = `dd1-${app.name}-${risk.id}`;
                            const isRiskExpanded = ddExpandedRisk === riskKey;
                            const isAtRisk = status !== "blocked";
                            const statusLabel = isAtRisk ? "At Risk" : "Reduced Risk";
                            const isSelected = ddSelectedRisk[app.name] === risk.id;
                            return (
                              <div key={risk.id} style={{ borderBottom: i < risks.length - 1 ? "1px solid #f5f5f5" : "none" }}>
                                <div onClick={() => setDdExpandedRisk(isRiskExpanded ? null : riskKey)}
                                  style={{ display: "flex", alignItems: "center", padding: "9px 16px", cursor: "pointer", gap: 8, background: status === "exposed" ? "#fef2f210" : status === "succeeded" ? "#fefce808" : "#f0fdf408" }}>
                                  <input type="radio" name={`risk-${app.name}`} checked={isSelected}
                                    onChange={(e) => { e.stopPropagation(); setDdSelectedRisk(prev => ({ ...prev, [app.name]: risk.id })); }}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ accentColor: "#dc2626", cursor: "pointer", flexShrink: 0, margin: 0 }} />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{risk.name}</span>
                                    <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: "#9ca3af", marginLeft: 6 }}>{risk.id}</span>
                                  </div>
                                  <span style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLORS[status] }}>{statusLabel}</span>
                                    <span style={{ fontSize: 15, fontWeight: 700, color: STATUS_COLORS[status] }}>{STATUS_ICONS[status]}</span>
                                  </span>
                                </div>
                                {isRiskExpanded && (
                                  <div style={{ padding: "10px 16px 14px", background: status === "exposed" ? "#fef2f210" : status === "succeeded" ? "#fefce810" : "#f0fdf410", borderTop: `1px dashed ${isAtRisk ? (status === "exposed" ? "#fecaca" : "#fde68a") : "#bbf7d0"}` }}>
                                    {(risk.elaboration || risk.goal) && (
                                      <div>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>
                                          Why is this important?
                                        </div>
                                        <div style={{ fontSize: 12, lineHeight: 1.7, color: "#374151" }}>
                                          {risk.elaboration && <div>{risk.elaboration}</div>}
                                          {risk.elaboration && risk.goal && <br />}
                                          {risk.goal && <div>{risk.goal}</div>}
                                        </div>
                                      </div>
                                    )}
                                    {riskObservations[risk.id]?.[app.name] && (
                                      <div style={{ marginTop: (risk.elaboration || risk.goal) ? 12 : 0 }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>
                                          {isAtRisk ? "Why am I at risk?" : "Observation"}
                                        </div>
                                        <div style={{ fontSize: 12, lineHeight: 1.7, color: "#374151" }}>
                                          {riskObservations[risk.id][app.name]}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          </div>{/* end scrollable content */}
                          {/* Email CTA — pinned at bottom */}
                          <div style={{ padding: "12px 16px", background: "#f8f9fb", borderTop: "1px solid #e5e7eb", flexShrink: 0 }}>
                            {ddSelectedRisk[app.name] && (
                              <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 6 }}>
                                Selected: <span style={{ fontWeight: 700, color: "#374151" }}>{risks.find(r => r.id === ddSelectedRisk[app.name])?.name}</span>
                              </div>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const selectedRisk = ddSelectedRisk[app.name] ? risks.find(r => r.id === ddSelectedRisk[app.name]) : null;
                                setEmailModal({ app, risk: selectedRisk });
                              }}
                              style={{ width: "100%", padding: "8px 0", borderRadius: 8, border: "1.5px solid #dc2626", background: "#fff", color: "#dc2626", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                            >
                              {ddSelectedRisk[app.name] ? `✉ Email CISO about ${risks.find(r => r.id === ddSelectedRisk[app.name])?.name}` : "✉ Email Agency CISO (all risks)"}
                            </button>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>{/* end right column */}

              </div>{/* end L1-Main grid */}

              {/* What can Android mobile apps do better? + Outlier Cards (aligned 7fr 3fr) */}
              <div id="dd-section-1">
              <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 12, marginTop: 8 }}>What can Android mobile apps do better?</div>
              <div style={{ display: "grid", gridTemplateColumns: "3fr 7fr", gap: 24, alignItems: "stretch", marginBottom: 32, minHeight: 600 }}>

                {/* LEFT: Outlier Cards (single column, scrollable) */}
                <div style={{ display: "flex", flexDirection: "column", height: 0, minHeight: "100%", overflow: "hidden" }}>
                  <div style={{ flex: 1, overflowY: "auto", minHeight: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    { riskId: "PF-06-R01", title: "Screen Recording", checkFn: a => a.status["PF-06-R01"][0] === "blocked" },
                    { riskId: "PF-05-R01/02/03", title: "Accessibility Abuse (all 3)", checkFn: a => ["PF-05-R01","PF-05-R02","PF-05-R03"].every(id => a.status[id][0] === "blocked") },
                    { riskId: "PF-04-R01", title: "Overlay Protection", checkFn: a => a.status["PF-04-R01"][0] === "blocked" },
                    { riskId: "PF-02-R02", title: "Log Capture", checkFn: a => a.status["PF-02-R02"][0] === "blocked" },
                    { riskId: "PF-01-R02", title: "APK Repackaging", checkFn: a => a.status["PF-01-R02"][0] === "blocked" },
                    { riskId: "PF-03-R01", title: "Traffic Interception", checkFn: a => a.status["PF-03-R01"][0] === "blocked" },
                  ].map(({ riskId, title, checkFn }) => {
                    const blockingApps = apps.filter(checkFn);
                    const failingApps = apps.filter(a => !checkFn(a));
                    const minorityIsBlocking = blockingApps.length <= failingApps.length;
                    const prominentApps = minorityIsBlocking ? blockingApps : failingApps;
                    const collapsedApps = minorityIsBlocking ? failingApps : blockingApps;
                    const prominentLabel = minorityIsBlocking ? `\u2713 ${blockingApps.length}/${totalApps} block this` : `\u2717 ${failingApps.length}/${totalApps} do not block this`;
                    const collapsedLabel = minorityIsBlocking ? `\u2717 ${failingApps.length}/${totalApps} do not block this` : `\u2713 ${blockingApps.length}/${totalApps} block this`;
                    const prominentBg = minorityIsBlocking ? "#dcfce7" : "#fee2e2";
                    const prominentColor = minorityIsBlocking ? "#065f46" : "#991b1b";
                    const prominentLabelColor = minorityIsBlocking ? "#059669" : "#dc2626";
                    const collapsedBg = minorityIsBlocking ? "#fee2e2" : "#dcfce7";
                    const collapsedColor = minorityIsBlocking ? "#991b1b" : "#065f46";
                    const collapsedLabelColor = minorityIsBlocking ? "#dc2626" : "#059669";
                    const affectedApps = minorityIsBlocking ? failingApps : prominentApps;
                    const isPinned = pinnedOutlierRisk === riskId;
                    const isHovered = hoveredOutlierRisk === riskId;
                    return (
                      <div key={riskId}
                        onMouseEnter={() => setHoveredOutlierRisk(riskId)}
                        onMouseLeave={() => setHoveredOutlierRisk(null)}
                        onClick={() => setPinnedOutlierRisk((prev) => (prev === riskId ? null : riskId))}
                        style={{ background: "#fff", borderRadius: 12, padding: "14px", border: (isPinned || isHovered) ? "1.5px solid #6366f1" : "1px solid #e5e7eb", boxShadow: (isPinned || isHovered) ? "0 0 0 3px #6366f120" : "0 1px 3px rgba(0,0,0,0.04)", flexShrink: 0, cursor: "pointer", transition: "border 0.15s, box-shadow 0.15s" }}>
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#111827", lineHeight: 1.3 }}>{title}</div>
                          <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: "#9ca3af", marginTop: 1 }}>{riskId}</div>
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: prominentLabelColor, marginBottom: 4 }}>{prominentLabel}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 8 }}>
                          {prominentApps.map(a => (
                            <div key={a.name} style={{ padding: "1px 6px", borderRadius: 10, fontSize: 9, fontWeight: 600, background: prominentBg, color: prominentColor }}>
                              {a.name.split(" ")[0]}
                            </div>
                          ))}
                        </div>
                        <div onClick={(e) => {
                          e.stopPropagation();
                          setExpandedOutlier(expandedOutlier === riskId ? null : riskId);
                        }}
                          style={{ fontSize: 10, fontWeight: 600, color: collapsedLabelColor, cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 3 }}>
                          <span style={{ fontSize: 8, transition: "transform 0.15s", display: "inline-block", transform: expandedOutlier === riskId ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                          {collapsedLabel}
                        </div>
                        {expandedOutlier === riskId && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 5 }}>
                            {collapsedApps.map(a => (
                              <div key={a.name} style={{ padding: "1px 6px", borderRadius: 10, fontSize: 9, fontWeight: 600, background: collapsedBg, color: collapsedColor }}>
                                {a.name.split(" ")[0]}
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ paddingTop: 10 }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOutlierEmailModal({ riskId, title, apps: affectedApps, selected: new Set(affectedApps.map(a => a.name)) });
                            }}
                            style={{ width: "100%", padding: "6px 0", borderRadius: 6, border: "1.5px solid #dc2626", background: "#fff", color: "#dc2626", fontSize: 10, fontWeight: 700, cursor: "pointer" }}
                          >
                            ✉ Email {affectedApps.length} Agency CISOs
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>

                {/* RIGHT: Diverging Bar Chart */}
                <div style={{ background: "#fff", borderRadius: 16, padding: "24px 28px", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", minHeight: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 12, color: "#9ca3af" }}>Left = reduced risk · Right = at risk · <span style={{ fontWeight: 700, color: "#111827", textDecoration: "underline" }}>hover or click cards to highlight</span></div>
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                        Showing {deepDiveVisibleRiskCount} of {totalRisks} risks
                        {deepDivePendingRiskCount > 0 ? ` (${deepDivePendingRiskCount} pending across one or more apps)` : ""}.
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: "#fef3c7", color: "#b45309" }}>PLATFORM-WIDE</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: `${deepDiveChartLabelWidth}px minmax(0,1fr) 1px minmax(0,1fr)`, alignItems: "center", marginBottom: 6 }}>
                    <div />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#9ca3af", fontWeight: 600, paddingRight: 10 }}>
                      <span>{totalApps}</span><span style={{ color: "#059669" }}>Reduced Risk</span><span>0</span>
                    </div>
                    <div />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#9ca3af", fontWeight: 600, paddingLeft: 10 }}>
                      <span>0</span><span style={{ color: "#dc2626" }}>At Risk</span><span>{totalApps}</span>
                    </div>
                  </div>
                  {systemicGaps.length === 0 && (
                    <div style={{ padding: "18px 0 6px", fontSize: 12, color: "#6b7280" }}>
                      Newly added risks stay hidden here until all apps have submitted real assessment results.
                    </div>
                  )}
                  <div style={{ display: "grid", rowGap: 12, flex: systemicGaps.length > 0 ? 1 : "unset", minHeight: 0, overflowY: systemicGaps.length > 0 ? "auto" : "visible", paddingRight: systemicGaps.length > 8 ? 4 : 0 }}>
                    {systemicGaps.map(g => {
                      const blockedApps = g.blockedApps;
                      const atRiskApps = g.atRiskApps;
                      const blocked = g.blocked;
                      const isHighlighted = highlightedOutlierRiskIds.includes(g.id);
                      const isDimmed = highlightedOutlierRiskIds.length > 0 && !isHighlighted;
                      return (
                        <div
                          key={g.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: `${deepDiveChartLabelWidth}px minmax(0,1fr) 1px minmax(0,1fr)`,
                            alignItems: "center",
                            minHeight: deepDiveChartRowHeight,
                            opacity: isDimmed ? 0.25 : 1,
                            transition: "opacity 0.15s, box-shadow 0.15s, background 0.15s",
                            borderRadius: 6,
                            boxSizing: "border-box",
                            background: isHighlighted ? "#f0f0ff" : "transparent",
                            boxShadow: isHighlighted ? "inset 0 0 0 1.5px #c7d2fe" : "none",
                          }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 500, color: "#374151", textAlign: "right", paddingRight: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#9ca3af", marginRight: 4 }}>{g.id}</span>{g.name}
                          </div>
                          <div title={blocked > 0 ? `Reduced risk (${blocked}): ${blockedApps.map(a => a.name).join(", ")}` : ""} style={{ display: "flex", justifyContent: "flex-end", paddingRight: 10 }}>
                            <div style={{ width: `${(blocked/safeTotalApps)*100}%`, height: 28, borderRadius: "4px 0 0 4px", background: "#059669", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", minWidth: blocked > 0 ? 24 : 0, pointerEvents: "none" }}>
                              {blocked > 0 ? blocked : ""}
                            </div>
                          </div>
                          <div style={{ width: 1, height: 28, background: "#374151" }} />
                          <div title={g.affected > 0 ? `At risk (${g.affected}): ${atRiskApps.map(a => a.name).join(", ")}` : ""} style={{ display: "flex", justifyContent: "flex-start", paddingLeft: 10 }}>
                            <div style={{ width: `${(g.affected/safeTotalApps)*100}%`, height: 28, borderRadius: "0 4px 4px 0", background: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", minWidth: g.affected > 0 ? 24 : 0, pointerEvents: "none" }}>
                              {g.affected}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>{/* end L1-Side grid */}
              </div>{/* end dd-section-1 */}

              </div>{/* end main content area */}

              </div>{/* end vertical carousel wrapper */}
            </>
          );
        })()}

        {/* ── TAB: ADD FINDINGS ── */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {tab === "addfindings" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 24, width: "100%", maxWidth: 820 }}>
              Add test results for a new or existing application across all {totalRisks} platform feature risks.
            </div>

            <div style={{ background: "#fff", borderRadius: 16, padding: "24px 24px", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", maxWidth: 820, width: "100%", margin: "0 auto" }}>

              {afSubmitted ? (
                <div style={{ textAlign: "center", padding: "48px 24px" }}>
                  <div style={{ fontSize: 40, marginBottom: 16 }}>&#10003;</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#059669", marginBottom: 8 }}>Findings Added</div>
                  <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 24 }}>The test results have been recorded. View them in the Deep Dive tab.</div>
                  <button onClick={resetAddFindingsForm}
                    style={{ padding: "10px 28px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}>
                    Add Another
                  </button>
                </div>
              ) : (
                <>
                  {/* App details */}
                  <div style={{ marginBottom: 28 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Application Details
                    </label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <input
                        type="text"
                        value={afAppName}
                        onChange={(e) => setAfAppName(e.target.value)}
                        list="existing-apps"
                        placeholder="App Name"
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, color: "#374151", fontFamily: "'Inter', system-ui, sans-serif", outline: "none", boxSizing: "border-box" }}
                      />
                      <input
                        type="text"
                        value={afAppAgency}
                        onChange={(e) => setAfAppAgency(e.target.value)}
                        placeholder="App Agency"
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, color: "#374151", fontFamily: "'Inter', system-ui, sans-serif", outline: "none", boxSizing: "border-box" }}
                      />
                      <input
                        type="text"
                        value={afAppVersion}
                        onChange={(e) => setAfAppVersion(e.target.value)}
                        placeholder="App Version (optional)"
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, color: "#374151", fontFamily: "'Inter', system-ui, sans-serif", outline: "none", boxSizing: "border-box" }}
                      />
                      <select
                        value={afSectorId}
                        onChange={(e) => setAfSectorId(e.target.value)}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, color: "#374151", fontFamily: "'Inter', system-ui, sans-serif", outline: "none", boxSizing: "border-box", background: "#fff" }}
                      >
                        {sectors.map((sector) => (
                          <option key={sector.id} value={sector.id}>
                            {sector.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "20px 0" }} />
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        CISO Point of Contact
                      </label>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {afPointOfContacts.map((contact, index) => (
                          <div key={contact.key} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px", background: "#fafafa" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>CISO {index + 1}</div>
                              {afPointOfContacts.length > 1 && (
                                <button
                                  onClick={() => {
                                    setAfPointOfContacts((prev) => prev.filter((item) => item.key !== contact.key));
                                  }}
                                  style={{ border: "none", background: "none", color: "#b91c1c", fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}
                                >
                                  REMOVE
                                </button>
                              )}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              <input
                                type="text"
                                value={contact.name}
                                onChange={(e) => {
                                  const nextValue = e.target.value;
                                  setAfPointOfContacts((prev) => prev.map((item) => (
                                    item.key === contact.key ? { ...item, name: nextValue } : item
                                  )));
                                }}
                                placeholder="CISO Name (optional)"
                                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, color: "#374151", fontFamily: "'Inter', system-ui, sans-serif", outline: "none", boxSizing: "border-box" }}
                              />
                              <input
                                type="text"
                                value={contact.number}
                                onChange={(e) => {
                                  const nextValue = e.target.value;
                                  setAfPointOfContacts((prev) => prev.map((item) => (
                                    item.key === contact.key ? { ...item, number: nextValue } : item
                                  )));
                                }}
                                placeholder="CISO Number (optional)"
                                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, color: "#374151", fontFamily: "'Inter', system-ui, sans-serif", outline: "none", boxSizing: "border-box" }}
                              />
                              <input
                                type="email"
                                value={contact.email}
                                onChange={(e) => {
                                  const nextValue = e.target.value;
                                  setAfPointOfContacts((prev) => prev.map((item) => (
                                    item.key === contact.key ? { ...item, email: nextValue } : item
                                  )));
                                }}
                                placeholder="CISO Email (optional)"
                                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, color: "#374151", fontFamily: "'Inter', system-ui, sans-serif", outline: "none", boxSizing: "border-box" }}
                              />
                            </div>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            setAfPointOfContacts((prev) => [...prev, createPocDraft()]);
                          }}
                          style={{ alignSelf: "flex-start", padding: "8px 14px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#fff", color: "#374151", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                        >
                          ADD CISO
                        </button>
                      </div>
                    </div>
                    <datalist id="existing-apps">
                      {apps.map((app) => (
                        <option key={app.name} value={app.name} />
                      ))}
                    </datalist>
                    {existingAppMatch && (
                      <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
                        Editing existing app: <span style={{ fontWeight: 700, color: "#374151" }}>{existingAppMatch.name}</span>. Agency, sector, and CISO point of contact details are preloaded and can be edited. Current assessed risks are preloaded; only pending risks like <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>PF-08-R01</span> need new input.
                      </div>
                    )}
                  </div>

                  {/* Risk sections — grouped by platform feature */}
                  {(() => {
                    const pfGroups = [];
                    const pfMap = {};
                    risks.forEach(risk => {
                      if (!pfMap[risk.pf]) { pfMap[risk.pf] = []; pfGroups.push({ pf: risk.pf, risks: pfMap[risk.pf] }); }
                      pfMap[risk.pf].push(risk);
                    });
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16, marginTop: 18, paddingTop: 18, borderTop: "1px solid #e5e7eb" }}>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Risks</label>
                        {pfGroups.map(group => (
                          <div key={group.pf} style={{ borderRadius: 8, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                            {/* PF group header */}
                            <div style={{ padding: "4px 10px", background: "#f3f4f6", borderBottom: "1px solid #e5e7eb" }}>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.06em" }}>{group.pf}</span>
                            </div>
                            {/* Risk rows */}
                            {group.risks.map((risk, idx) => {
                              const status = afRiskStatus[risk.id] || null;
                              const selected = afObservations[risk.id] || new Set();
                              const opts = afObservationOptions[risk.id] || { atRisk: [], notAtRisk: [] };
                              const availableObs = status === "at-risk" ? opts.atRisk : status === "not-at-risk" ? opts.notAtRisk : [];
                              const isLast = idx === group.risks.length - 1;
                              return (
                                <div key={risk.id} style={{ borderBottom: isLast && !status ? "none" : "1px solid #f3f4f6" }}>
                                  {/* Inline row: id · name · toggles */}
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px" }}>
                                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, fontWeight: 600, color: "#c4c9d4", whiteSpace: "nowrap", minWidth: 68 }}>{risk.id}</span>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: "#111827", flex: 1 }}>{risk.name}</span>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 180, justifyContent: "flex-end" }}>
                                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: status && status !== "not-at-risk" ? "#dc2626" : "#9ca3af", transition: "color 0.12s" }}>
                                        At Risk
                                      </span>
                                      <button
                                        type="button"
                                        role="switch"
                                        aria-checked={status === "not-at-risk"}
                                        aria-label={`${risk.id} status toggle`}
                                        onClick={() => {
                                          const nextStatus = status === "at-risk" ? "not-at-risk" : "at-risk";
                                          setAfRiskStatus((prev) => ({ ...prev, [risk.id]: nextStatus }));
                                          setAfObservations((prev) => ({ ...prev, [risk.id]: new Set() }));
                                        }}
                                        style={{
                                          position: "relative",
                                          width: 56,
                                          height: 28,
                                          borderRadius: 999,
                                          border: `1.5px solid ${status ? (status === "not-at-risk" ? "#86efac" : "#fca5a5") : "#e5e7eb"}`,
                                          background: status ? (status === "not-at-risk" ? "#dcfce7" : "#fee2e2") : "#f8fafc",
                                          cursor: "pointer",
                                          padding: 0,
                                          transition: "all 0.12s",
                                        }}
                                      >
                                        <span
                                          style={{
                                            position: "absolute",
                                            top: 2,
                                            left: status === "not-at-risk" ? 30 : 2,
                                            width: 22,
                                            height: 22,
                                            borderRadius: "50%",
                                            background: status ? (status === "not-at-risk" ? "#059669" : "#dc2626") : "#cbd5e1",
                                            boxShadow: "0 1px 3px rgba(15,23,42,0.18)",
                                            transition: "left 0.12s, background 0.12s",
                                          }}
                                        />
                                      </button>
                                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: status === "not-at-risk" ? "#059669" : "#9ca3af", transition: "color 0.12s" }}>
                                        Reduced Risk
                                      </span>
                                    </div>
                                  </div>
                                  {/* Observations — indented, only when status set */}
                                  {status && availableObs.length > 0 && (
                                    <div style={{ padding: "0 10px 8px 86px", borderTop: "1px solid #f3f4f6" }}>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, paddingTop: 6 }}>
                                        {availableObs.map(obs => {
                                          const isSelected = selected.has(obs);
                                          return (
                                            <button key={obs}
                                              onClick={() => { setAfObservations(prev => { const next = new Set(prev[risk.id] || []); if (next.has(obs)) next.delete(obs); else next.add(obs); return { ...prev, [risk.id]: next }; }); }}
                                              style={{ padding: "3px 8px", borderRadius: 4, fontSize: 9, fontWeight: 500, cursor: "pointer", border: `1px solid ${isSelected ? (status === "at-risk" ? "#fecaca" : "#bbf7d0") : "#e5e7eb"}`, background: isSelected ? (status === "at-risk" ? "#fee2e2" : "#dcfce7") : "#f9fafb", color: isSelected ? (status === "at-risk" ? "#dc2626" : "#059669") : "#6b7280", transition: "all 0.12s" }}
                                            >{obs}</button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Demonstration upload */}
                  <div style={{ marginBottom: 28, marginTop: 18, paddingTop: 18, borderTop: "1px solid #e5e7eb" }}>
                  <div style={{ padding: "20px", borderRadius: 12, border: "1px solid #e5e7eb", background: "#fafafa" }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Demonstration
                    </label>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 10 }}>Upload supporting evidence (PDF or DOCX only)</div>
                    <input
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => setAfDemoFile(e.target.files[0] || null)}
                      style={{ fontSize: 12, color: "#374151" }}
                    />
                    {afDemoFile && (
                      <div style={{ marginTop: 8, fontSize: 11, color: "#059669", fontWeight: 600 }}>
                        Selected: {afDemoFile.name} ({(afDemoFile.size / 1024).toFixed(0)} KB)
                      </div>
                    )}
                  </div>
                  </div>

                  {/* ADD button */}
                  <button
                    onClick={async () => {
                      if (!afAppName.trim() || !afAppAgency.trim() || !afSectorId) {
                        alert("Please enter app name, app agency, and sector.");
                        return;
                      }

                      const requiredFindingsRisks = existingAppMatch
                        ? risks.filter((risk) => pendingAssessmentRiskIds.has(risk.id))
                        : risks;

                      const missingStatusRisks = requiredFindingsRisks.filter((risk) => {
                        const status = afRiskStatus[risk.id];
                        return status !== "at-risk" && status !== "not-at-risk";
                      });
                      if (missingStatusRisks.length > 0) {
                        alert(`Please set At Risk or Reduced Risk for all required risks. Missing: ${missingStatusRisks.map((risk) => risk.id).join(", ")}`);
                        return;
                      }

                      const missingObservationRisks = requiredFindingsRisks.filter((risk) => {
                        const status = afRiskStatus[risk.id];
                        const opts = afObservationOptions[risk.id] || { atRisk: [], notAtRisk: [] };
                        const availableObs = status === "at-risk" ? opts.atRisk : opts.notAtRisk;
                        if (!availableObs || availableObs.length === 0) return false;
                        const selected = afObservations[risk.id];
                        return !(selected instanceof Set) || selected.size === 0;
                      });
                      if (missingObservationRisks.length > 0) {
                        alert(`Please select at least one observation for: ${missingObservationRisks.map((risk) => risk.id).join(", ")}`);
                        return;
                      }

                      const trimmedAppName = afAppName.trim();
                      const trimmedAppAgency = afAppAgency.trim();
                      const trimmedAppVersion = afAppVersion.trim();
                      const trimmedPointOfContacts = afPointOfContacts
                        .map((contact) => ({
                          name: contact.name.trim(),
                          number: contact.number.trim(),
                          email: contact.email.trim(),
                        }))
                        .filter((contact) => contact.name || contact.number || contact.email);
                      let demoFileContentBase64 = null;
                      if (afDemoFile) {
                        demoFileContentBase64 = await readFileAsBase64(afDemoFile);
                      }
                      const findings = {
                        metadata: trimmedAppVersion ? `${trimmedAppName} (v${trimmedAppVersion})` : trimmedAppName,
                        appName: trimmedAppName,
                        agency: trimmedAppAgency,
                        sectorId: afSectorId,
                        appVersion: trimmedAppVersion || null,
                        pointOfContacts: trimmedPointOfContacts,
                        riskStatus: afRiskStatus,
                        observations: Object.fromEntries(Object.entries(afObservations).map(([k, v]) => [k, [...v]])),
                        demoFileName: afDemoFile?.name || null,
                        demoFileContentBase64,
                      };

                      try {
                        const response = await fetch("/api/findings", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(findings),
                        });

                        if (!response.ok) {
                          const errorPayload = await response.json().catch(() => ({}));
                          const details = errorPayload.details ? ` (${errorPayload.details})` : "";
                          throw new Error((errorPayload.error || `API returned ${response.status}`) + details);
                        }

                        const dashboardResponse = await fetch("/api/dashboard-data");
                        if (dashboardResponse.ok) {
                          const dashboardPayload = await dashboardResponse.json();
                          applyDashboardData(dashboardPayload);
                          setDataVersion((v) => v + 1);
                        }

                        setAfSubmitted(true);
                      } catch (error) {
                        alert(`Unable to save findings to database. ${error.message}`);
                      }
                    }}
                    style={{
                      width: "100%", padding: "14px 0", borderRadius: 10, border: "none",
                      background: "#0f172a", color: "#fff", fontSize: 14, fontWeight: 700,
                      cursor: "pointer", letterSpacing: "0.02em",
                    }}
                  >
                    ADD FINDINGS
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* â”€â”€ TAB: ADD PLATFORM FEATURE / RISK â”€â”€ */}
        {tab === "addrisk" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 20, width: "100%", maxWidth: 900 }}>
              Add a platform feature first, then add risks under it. IDs must be unique.
            </div>

            <div style={{ width: "100%", maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "#fff", borderRadius: 16, padding: "20px 24px", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 14 }}>
                  1. Add Platform Feature
                </div>
                {apfSubmitted && (
                  <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 8, background: "#ecfdf5", border: "1px solid #a7f3d0", fontSize: 12, color: "#065f46", fontWeight: 600 }}>
                    Platform feature saved successfully.
                  </div>
                )}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 5 }}>Platform Feature ID</div>
                  <input
                    type="text"
                    value={apfId}
                    onChange={(e) => {
                      setApfId(e.target.value);
                      setApfSubmitted(false);
                    }}
                    placeholder="e.g. PF-08 or platform-feature-08"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, color: "#374151", fontFamily: "'Inter', system-ui, sans-serif", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 5 }}>Description</div>
                  <textarea
                    value={apfDescription}
                    onChange={(e) => {
                      setApfDescription(e.target.value);
                      setApfSubmitted(false);
                    }}
                    placeholder="Platform feature description"
                    style={{ width: "100%", minHeight: 80, padding: "10px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, lineHeight: 1.5, color: "#374151", fontFamily: "'Inter', system-ui, sans-serif", resize: "vertical", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 5 }}>Additional Context</div>
                  <textarea
                    value={apfAdditionalContext}
                    onChange={(e) => {
                      setApfAdditionalContext(e.target.value);
                      setApfSubmitted(false);
                    }}
                    placeholder="Additional context (optional)"
                    style={{ width: "100%", minHeight: 80, padding: "10px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, lineHeight: 1.5, color: "#374151", fontFamily: "'Inter', system-ui, sans-serif", resize: "vertical", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 5 }}>Additional Context + Demo (PDF or DOCX)</div>
                  <input
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => {
                      setApfDemoFile(e.target.files?.[0] || null);
                      setApfSubmitted(false);
                    }}
                    style={{ width: "100%", fontSize: 12, color: "#374151" }}
                  />
                  {apfDemoFile && (
                    <div style={{ marginTop: 6, fontSize: 11, color: "#6b7280" }}>
                      Selected: {apfDemoFile.name}
                    </div>
                  )}
                </div>
                {riskDrafts.length > 0 && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 14 }}>
                      2. Add Risk
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {riskDrafts.map((draft, index) => {
                        const normalizedRisk = normalizeRiskInput(apfId, draft.riskId);
                        const match = normalizedRisk.match(/^PF-(\d{2})-R(\d{2})$/);
                        const slug = match ? `platform-feature-${match[1]}-risk-${match[2]}` : "";
                        return (
                          <div key={draft.key} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 14px 12px", background: "#fafafa" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>Risk {index + 1}</div>
                              <button
                                onClick={() => {
                                  setRiskDrafts((prev) => prev.filter((item) => item.key !== draft.key));
                                  setApfSubmitted(false);
                                }}
                                style={{ border: "none", background: "none", color: "#b91c1c", fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}
                              >
                                REMOVE
                              </button>
                            </div>
                            <div style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 5 }}>Risk ID</div>
                              <input
                                type="text"
                                value={draft.riskId}
                                onChange={(e) => {
                                  const nextValue = e.target.value;
                                  setRiskDrafts((prev) => prev.map((item) => (
                                    item.key === draft.key ? { ...item, riskId: nextValue } : item
                                  )));
                                  setApfSubmitted(false);
                                }}
                                placeholder="e.g. risk-01, R01, or platform-feature-08-risk-01"
                                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, color: "#374151", fontFamily: "'Inter', system-ui, sans-serif", outline: "none", boxSizing: "border-box" }}
                              />
                              <div style={{ marginTop: 6, fontSize: 11, color: "#6b7280" }}>
                                Canonical ID: {normalizedRisk || "PF-XX-RZZ"}{slug ? ` (${slug})` : ""}
                              </div>
                            </div>
                            <div style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 5 }}>Description</div>
                              <textarea
                                value={draft.description}
                                onChange={(e) => {
                                  const nextValue = e.target.value;
                                  setRiskDrafts((prev) => prev.map((item) => (
                                    item.key === draft.key ? { ...item, description: nextValue } : item
                                  )));
                                  setApfSubmitted(false);
                                }}
                                placeholder="Risk description"
                                style={{ width: "100%", minHeight: 80, padding: "10px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, lineHeight: 1.5, color: "#374151", fontFamily: "'Inter', system-ui, sans-serif", resize: "vertical", outline: "none", boxSizing: "border-box" }}
                              />
                            </div>
                            <div>
                              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 5 }}>Demo (PDF or DOCX)</div>
                              <input
                                type="file"
                                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                onChange={(e) => {
                                  const nextFile = e.target.files?.[0] || null;
                                  setRiskDrafts((prev) => prev.map((item) => (
                                    item.key === draft.key ? { ...item, demoFile: nextFile } : item
                                  )));
                                  setApfSubmitted(false);
                                }}
                                style={{ width: "100%", fontSize: 12, color: "#374151" }}
                              />
                              {draft.demoFile && (
                                <div style={{ marginTop: 6, fontSize: 11, color: "#6b7280" }}>
                                  Selected: {draft.demoFile.name}
                                </div>
                              )}
                            </div>
                            <div style={{ marginTop: 10 }}>
                              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 5 }}>At Risk Observations</div>
                              <textarea
                                value={draft.atRiskObservationsText}
                                onChange={(e) => {
                                  const nextValue = e.target.value;
                                  setRiskDrafts((prev) => prev.map((item) => (
                                    item.key === draft.key ? { ...item, atRiskObservationsText: nextValue } : item
                                  )));
                                  setApfSubmitted(false);
                                }}
                                placeholder={"One per line\nExample: SMS can be read\nExample: OTP messages are accessible"}
                                style={{ width: "100%", minHeight: 72, padding: "10px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, lineHeight: 1.5, color: "#374151", fontFamily: "'Inter', system-ui, sans-serif", resize: "vertical", outline: "none", boxSizing: "border-box" }}
                              />
                            </div>
                            <div style={{ marginTop: 10 }}>
                              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 5 }}>Reduced Risk Observations</div>
                              <textarea
                                value={draft.notAtRiskObservationsText}
                                onChange={(e) => {
                                  const nextValue = e.target.value;
                                  setRiskDrafts((prev) => prev.map((item) => (
                                    item.key === draft.key ? { ...item, notAtRiskObservationsText: nextValue } : item
                                  )));
                                  setApfSubmitted(false);
                                }}
                                placeholder={"One per line\nExample: SMS access is blocked\nExample: User consent is enforced"}
                                style={{ width: "100%", minHeight: 72, padding: "10px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, lineHeight: 1.5, color: "#374151", fontFamily: "'Inter', system-ui, sans-serif", resize: "vertical", outline: "none", boxSizing: "border-box" }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <button
                  onClick={() => {
                    setApfSubmitted(false);
                    setRiskDrafts((prev) => [...prev, createRiskDraft()]);
                  }}
                  style={{
                    width: "100%",
                    marginTop: riskDrafts.length > 0 ? 16 : 10,
                    padding: "11px 0",
                    borderRadius: 10,
                    border: "1.5px solid #0f172a",
                    background: "#fff",
                    color: "#0f172a",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    letterSpacing: "0.02em",
                  }}
                >
                  ADD NEW RISK
                </button>
                <button
                  onClick={async () => {
                    const platformFeatureId = apfId.trim();
                    const name = apfDescription.trim();
                    if (!platformFeatureId || !name) {
                      alert("Please enter Platform Feature ID and Name.");
                      return;
                    }

                    const normalizedPfId = normalizePlatformFeatureInput(platformFeatureId) || platformFeatureId.toUpperCase();
                    const incompleteRisk = riskDrafts.find((draft) => !draft.riskId.trim() || !draft.description.trim());
                    if (incompleteRisk) {
                      alert("Each added risk must include both Risk ID and Description.");
                      return;
                    }
                    const existingPlatformFeature = platformFeatures.find((pf) => pf.id === normalizedPfId) || null;
                    if (existingPlatformFeature && riskDrafts.length === 0) {
                      alert(`Platform feature ${normalizedPfId} already exists.`);
                      return;
                    }

                    try {
                      let demoFileContentBase64 = "";
                      if (apfDemoFile) {
                        demoFileContentBase64 = await readFileAsBase64(apfDemoFile);
                      }

                      let createdPfId = existingPlatformFeature?.id || normalizedPfId;
                      if (!existingPlatformFeature) {
                        const response = await fetch("/api/platform-features", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            platformFeatureId,
                            name,
                            additionalContext: apfAdditionalContext.trim(),
                            demoFileName: apfDemoFile ? apfDemoFile.name : "",
                            demoFileContentBase64,
                          }),
                        });

                        const responsePayload = await response.json().catch(() => ({}));
                        if (!response.ok) {
                          throw new Error(responsePayload.error || `API returned ${response.status}`);
                        }
                        createdPfId = responsePayload.platformFeature?.id || createdPfId;
                      }

                      for (const draft of riskDrafts) {
                        let riskDemoFileContentBase64 = "";
                        if (draft.demoFile) {
                          riskDemoFileContentBase64 = await readFileAsBase64(draft.demoFile);
                        }

                        const riskResponse = await fetch("/api/risks", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            platformFeatureId: createdPfId,
                            riskId: draft.riskId.trim(),
                            description: draft.description.trim(),
                            observationOptions: {
                              atRisk: draft.atRiskObservationsText.split("\n").map((value) => value.trim()).filter(Boolean),
                              notAtRisk: draft.notAtRiskObservationsText.split("\n").map((value) => value.trim()).filter(Boolean),
                            },
                            demoFileName: draft.demoFile ? draft.demoFile.name : "",
                            demoFileContentBase64: riskDemoFileContentBase64,
                          }),
                        });

                        const riskPayload = await riskResponse.json().catch(() => ({}));
                        if (!riskResponse.ok) {
                          throw new Error(riskPayload.error || `Failed to create risk for ${draft.riskId.trim() || "draft"}`);
                        }
                      }

                      const dashboardResponse = await fetch("/api/dashboard-data");
                      if (dashboardResponse.ok) {
                        const dashboardPayload = await dashboardResponse.json();
                        applyDashboardData(dashboardPayload);
                        setDataVersion((v) => v + 1);
                      }

                      setApfId(createdPfId);
                      setApfDescription("");
                      setApfAdditionalContext("");
                      setApfDemoFile(null);
                      setRiskDrafts([]);
                      setApfSubmitted(true);
                    } catch (error) {
                      alert(`Unable to add platform feature. ${error.message}`);
                    }
                  }}
                  style={{
                    width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
                    background: "#0f172a", color: "#fff", fontSize: 13, fontWeight: 700,
                    cursor: "pointer", letterSpacing: "0.02em", marginTop: 18,
                  }}
                >
                  SAVE PLATFORM FEATURE
                </button>
              </div>

              {/* Platform Feature Tree — hierarchical with dropdown risks */}
              <div style={{ background: "#fff", borderRadius: 16, padding: "20px 24px", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 6 }}>
                  Platform Feature Tree
                  <span style={{ fontSize: 12, fontWeight: 400, color: "#9ca3af", marginLeft: 8 }}>
                    {platformFeatures.length} features · {risks.length} risks
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>
                  Click a platform feature to expand its risks.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {[...platformFeatures]
                    .sort((a, b) => a.id.localeCompare(b.id))
                    .map((pf) => {
                      const pfRisks = risks.filter(r => r.pf === pf.id).sort((a, b) => a.id.localeCompare(b.id));
                      const isOpen = selectedPf === pf.id;
                      return (
                        <div key={pf.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                          {/* PF row */}
                          <div
                            onClick={() => setSelectedPf(isOpen ? null : pf.id)}
                            style={{ display: "flex", alignItems: "center", padding: "12px 8px", cursor: "pointer", gap: 10, borderRadius: 8, transition: "background 0.1s", background: isOpen ? "#f8fafc" : "transparent" }}
                            onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = "#fafafa"; }}
                            onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = "transparent"; }}
                          >
                            <span style={{ fontSize: 10, transition: "transform 0.15s", display: "inline-block", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", color: "#6b7280", flexShrink: 0 }}>▶</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>{pf.id}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{pf.name || "No name"}</span>
                            <span style={{ marginLeft: "auto", fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>{pfRisks.length} risk{pfRisks.length !== 1 ? "s" : ""}</span>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!window.confirm(`Delete feature ${pf.id} "${pf.name}"? This will also delete all its risks and findings.`)) return;
                                try {
                                  const res = await fetch(`/api/platform-features/${pf.id}`, { method: "DELETE" });
                                  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Delete failed"); }
                                  const dashRes = await fetch("/api/dashboard-data");
                                  if (dashRes.ok) { applyDashboardData(await dashRes.json()); setDataVersion((v) => v + 1); }
                                } catch (err) { alert(`Failed to delete feature: ${err.message}`); }
                              }}
                              style={{ marginLeft: 6, background: "none", border: "none", cursor: "pointer", color: "#d1d5db", fontSize: 13, padding: "2px 6px", borderRadius: 4, lineHeight: 1, flexShrink: 0 }}
                              onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; }}
                              onMouseLeave={e => { e.currentTarget.style.color = "#d1d5db"; }}
                              title="Delete feature"
                            >✕</button>
                          </div>
                          {/* Risk children (collapsible) */}
                          {isOpen && (
                            <div style={{ marginLeft: 20, borderLeft: "2px solid #e5e7eb", marginBottom: 8 }}>
                              {pfRisks.length === 0 ? (
                                <div style={{ padding: "10px 16px", fontSize: 12, color: "#9ca3af" }}>No risks added yet.</div>
                              ) : pfRisks.map((risk, i) => {
                                const observationOptions = afObservationOptions[risk.id] || { atRisk: [], notAtRisk: [] };
                                const riskKey = `pftree-${risk.id}`;
                                const isExpanded = ddExpandedRisk === riskKey;
                                return (
                                  <div key={risk.id} style={{ borderBottom: i < pfRisks.length - 1 ? "1px solid #f5f5f5" : "none" }}>
                                    {/* Risk row */}
                                    <div onClick={() => setDdExpandedRisk(isExpanded ? null : riskKey)}
                                      style={{ display: "flex", alignItems: "center", padding: "9px 14px", cursor: "pointer", gap: 8, borderRadius: 6, transition: "background 0.1s" }}
                                      onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = "#fafafa"; }}
                                      onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = "transparent"; }}
                                    >
                                      <span style={{ fontSize: 8, transition: "transform 0.15s", display: "inline-block", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", color: "#9ca3af", flexShrink: 0 }}>▶</span>
                                      <span style={{ fontSize: 10, fontWeight: 700, color: "#334155", fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>{risk.id}</span>
                                      <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{risk.name}</span>
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          if (!window.confirm(`Delete risk ${risk.id} "${risk.name}"? This will also delete all its findings.`)) return;
                                          try {
                                            const res = await fetch(`/api/risks/${risk.id}`, { method: "DELETE" });
                                            if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Delete failed"); }
                                            const dashRes = await fetch("/api/dashboard-data");
                                            if (dashRes.ok) { applyDashboardData(await dashRes.json()); setDataVersion((v) => v + 1); }
                                          } catch (err) { alert(`Failed to delete risk: ${err.message}`); }
                                        }}
                                        style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#d1d5db", fontSize: 12, padding: "2px 6px", borderRadius: 4, lineHeight: 1, flexShrink: 0 }}
                                        onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; }}
                                        onMouseLeave={e => { e.currentTarget.style.color = "#d1d5db"; }}
                                        title="Delete risk"
                                      >✕</button>
                                    </div>
                                    {/* Risk detail (collapsible) */}
                                    {isExpanded && (
                                      <div style={{ padding: "4px 14px 14px 32px" }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                                          Why Is This Important?
                                        </div>
                                        <div style={{ fontSize: 12, lineHeight: 1.7, color: "#374151", marginBottom: 12 }}>
                                          {risk.elaboration || "No description"}
                                        </div>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                          <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>At Risk</div>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                              {observationOptions.atRisk.length > 0 ? observationOptions.atRisk.map(item => (
                                                <span key={item} style={{ fontSize: 10, color: "#991b1b", background: "#fee2e2", padding: "3px 7px", borderRadius: 999 }}>{item}</span>
                                              )) : <span style={{ fontSize: 10, color: "#9ca3af" }}>None</span>}
                                            </div>
                                          </div>
                                          <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Reduced Risk</div>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                              {observationOptions.notAtRisk.length > 0 ? observationOptions.notAtRisk.map(item => (
                                                <span key={item} style={{ fontSize: 10, color: "#065f46", background: "#d1fae5", padding: "3px 7px", borderRadius: 999 }}>{item}</span>
                                              )) : <span style={{ fontSize: 10, color: "#9ca3af" }}>None</span>}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── EMAIL MODAL ── */}
      {emailModal && (() => {
        const { subject, body } = buildEmail(emailModal.app, emailModal.risk || null);
        const score = getWeightedScore(emailModal.app);
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.65)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ background: "#fff", borderRadius: 20, width: "780px", minWidth: 480, minHeight: 520, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.35)", resize: "both", overflow: "hidden" }}>
              {/* Header */}
              <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #e5e7eb" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Draft Risk Notification</div>
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>
                      {emailModal.app.name}{emailModal.app.appVersion ? ` v${emailModal.app.appVersion}` : ""} · {emailModal.app.agency}{emailModal.risk ? ` · ${emailModal.risk.name}` : ` · ${score}/${totalRisks} risks unblocked`}
                    </div>
                  </div>
                  <button onClick={() => setEmailModal(null)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#9ca3af", lineHeight: 1, padding: 0 }}>×</button>
                </div>
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", width: 52, flexShrink: 0 }}>To</span>
                    <span style={{ fontSize: 12, color: "#374151", background: "#f8f9fb", padding: "5px 12px", borderRadius: 6, flex: 1 }}>CISO, {emailModal.app.agency}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", width: 52, flexShrink: 0 }}>Subject</span>
                    <span style={{ fontSize: 12, color: "#374151", background: "#f8f9fb", padding: "5px 12px", borderRadius: 6, flex: 1 }}>{subject}</span>
                  </div>
                </div>
              </div>
              {/* Body — editable */}
              <textarea
                defaultValue={body}
                style={{ flex: 1, margin: "0 24px", padding: "16px 0", border: "none", outline: "none", resize: "none", fontSize: 12, lineHeight: 1.75, color: "#374151", fontFamily: "'Inter', system-ui, sans-serif", overflowY: "auto", minHeight: 0 }}
              />
              {/* Actions */}
              <div style={{ padding: "14px 24px 20px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 10 }}>
                <button
                  onClick={() => navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`)}
                  style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}
                >
                  Copy to Clipboard
                </button>
                <button
                  onClick={() => window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)}
                  style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", background: "#0f172a", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#fff" }}
                >
                  Open in Mail
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── OUTLIER EMAIL MODAL ── */}
      {outlierEmailModal && (() => {
        const selected = outlierEmailModal.selected;
        const selectedApps = outlierEmailModal.apps.filter(a => selected.has(a.name));
        const viewIdx = outlierEmailModal.viewIdx || 0;
        const currentApp = selectedApps[viewIdx] || selectedApps[0];
        if (!currentApp) return null;
        const { subject, body, to } = buildOutlierEmail(outlierEmailModal.title, outlierEmailModal.riskId, currentApp);
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.65)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ background: "#fff", borderRadius: 20, width: "780px", minWidth: 480, minHeight: 520, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.35)", resize: "both", overflow: "hidden" }}>
              {/* Header */}
              <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #e5e7eb" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Draft Outlier Notification — {outlierEmailModal.title}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>
                      {selectedApps.length} email{selectedApps.length !== 1 ? "s" : ""} to send · viewing {viewIdx + 1} of {selectedApps.length}
                    </div>
                  </div>
                  <button onClick={() => setOutlierEmailModal(null)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#9ca3af", lineHeight: 1, padding: 0 }}>×</button>
                </div>
                {/* App checkboxes — select which agencies to email */}
                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {outlierEmailModal.apps.map(a => {
                    const isChecked = selected.has(a.name);
                    const isCurrent = currentApp && currentApp.name === a.name;
                    return (
                      <label key={a.name} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 8, border: `1.5px solid ${isCurrent ? "#0f172a" : isChecked ? "#dc2626" : "#e5e7eb"}`, background: isCurrent ? "#0f172a" : isChecked ? "#fef2f2" : "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600, color: isCurrent ? "#fff" : isChecked ? "#991b1b" : "#6b7280" }}>
                        <input type="checkbox" checked={isChecked}
                          onChange={() => {
                            setOutlierEmailModal(prev => {
                              const next = new Set(prev.selected);
                              if (next.has(a.name)) next.delete(a.name); else next.add(a.name);
                              return { ...prev, selected: next, viewIdx: 0 };
                            });
                          }}
                          style={{ accentColor: isCurrent ? "#fff" : "#dc2626", margin: 0, cursor: "pointer" }} />
                        {a.name} <span style={{ fontWeight: 400, opacity: 0.7 }}>({a.agency})</span>
                      </label>
                    );
                  })}
                </div>
                {/* To / Subject for current app */}
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", width: 52, flexShrink: 0 }}>To</span>
                    <span style={{ fontSize: 12, color: "#374151", background: "#f8f9fb", padding: "5px 12px", borderRadius: 6, flex: 1 }}>{to}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", width: 52, flexShrink: 0 }}>Subject</span>
                    <span style={{ fontSize: 12, color: "#374151", background: "#f8f9fb", padding: "5px 12px", borderRadius: 6, flex: 1 }}>{subject}</span>
                  </div>
                </div>
              </div>
              {/* Body — editable, per app */}
              <textarea
                key={currentApp.name}
                defaultValue={body}
                style={{ flex: 1, margin: "0 24px", padding: "16px 0", border: "none", outline: "none", resize: "none", fontSize: 12, lineHeight: 1.75, color: "#374151", fontFamily: "'Inter', system-ui, sans-serif", overflowY: "auto", minHeight: 0 }}
              />
              {/* Actions */}
              <div style={{ padding: "14px 24px 20px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 10, alignItems: "center" }}>
                {/* Prev / Next navigation */}
                <div style={{ display: "flex", gap: 6, marginRight: "auto" }}>
                  <button
                    disabled={viewIdx <= 0}
                    onClick={() => setOutlierEmailModal(prev => ({ ...prev, viewIdx: prev.viewIdx - 1 }))}
                    style={{ padding: "7px 14px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 600, cursor: viewIdx > 0 ? "pointer" : "default", color: viewIdx > 0 ? "#374151" : "#d1d5db" }}
                  >
                    ← Prev
                  </button>
                  <button
                    disabled={viewIdx >= selectedApps.length - 1}
                    onClick={() => setOutlierEmailModal(prev => ({ ...prev, viewIdx: prev.viewIdx + 1 }))}
                    style={{ padding: "7px 14px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 600, cursor: viewIdx < selectedApps.length - 1 ? "pointer" : "default", color: viewIdx < selectedApps.length - 1 ? "#374151" : "#d1d5db" }}
                  >
                    Next →
                  </button>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`)}
                  style={{ padding: "9px 18px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}
                >
                  Copy
                </button>
                <button
                  onClick={() => {
                    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
                    if (viewIdx < selectedApps.length - 1) {
                      setOutlierEmailModal(prev => ({ ...prev, viewIdx: (prev.viewIdx || 0) + 1 }));
                    }
                  }}
                  style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#0f172a", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#fff" }}
                >
                  {viewIdx < selectedApps.length - 1 ? `Open Mail & Next (${viewIdx + 1}/${selectedApps.length})` : `Open Mail (${viewIdx + 1}/${selectedApps.length})`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

