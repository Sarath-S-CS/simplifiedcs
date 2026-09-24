// AI-2: a stated version turns "potential match - confirm your version" into
// NVD's own answer for that exact version. These cases pin how each
// supported product's version is written in NVD's naming (CPE), checked
// against live NVD lookups when this was written (24 Sep 2026), and that
// anything else - unsupported vendors, unrecognised version text - is not
// looked up at all rather than looked up wrongly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveProduct, versionLookupFor } from "../netlify/lib/product-catalog.ts";

const lookup = (category, name, version) => versionLookupFor(resolveProduct(category, name, 0, version));
const cpe = (category, name, version) => lookup(category, name, version)?.cpeName ?? null;

test("firewall versions map to NVD's naming for each supported vendor", () => {
  const edge = "edge device / firewall";
  assert.equal(cpe(edge, "Fortinet FortiGate", "7.4.3"), "cpe:2.3:o:fortinet:fortios:7.4.3:*:*:*:*:*:*:*");
  assert.equal(cpe(edge, "Fortinet FortiGate", "FortiOS v7.4.3 build2573"), "cpe:2.3:o:fortinet:fortios:7.4.3:*:*:*:*:*:*:*");
  assert.equal(cpe(edge, "Palo Alto Networks", "11.1.2-h3"), "cpe:2.3:o:paloaltonetworks:pan-os:11.1.2:h3:*:*:*:*:*:*");
  assert.equal(cpe(edge, "Palo Alto Networks", "PAN-OS 10.2.9"), "cpe:2.3:o:paloaltonetworks:pan-os:10.2.9:*:*:*:*:*:*:*");
  assert.equal(cpe(edge, "SonicWall", "7.0.1-5145"), "cpe:2.3:o:sonicwall:sonicos:7.0.1-5145:*:*:*:*:*:*:*");
  assert.equal(cpe(edge, "SonicWall", "SonicOS 7.1.1"), "cpe:2.3:o:sonicwall:sonicos:7.1.1:*:*:*:*:*:*:*");
  assert.equal(cpe(edge, "Juniper Networks SRX", "22.4R3-S2"), "cpe:2.3:o:juniper:junos:22.4:r3-s2:*:*:*:*:*:*");
  assert.equal(cpe(edge, "Juniper Networks SRX", "Junos 23.2R1"), "cpe:2.3:o:juniper:junos:23.2:r1:*:*:*:*:*:*");
  assert.equal(cpe(edge, "WatchGuard", "12.10.3"), "cpe:2.3:o:watchguard:fireware:12.10.3:*:*:*:*:*:*:*");
  // A free-text "Other" answer that names a supported product counts too.
  assert.equal(cpe(edge, "FortiGate 60F", "7.2.8"), "cpe:2.3:o:fortinet:fortios:7.2.8:*:*:*:*:*:*:*");
});

test("web server versions are read from the free-text answer", () => {
  const web = "web server stack";
  assert.equal(cpe(web, "nginx 1.24.0 on Ubuntu 22.04"), "cpe:2.3:a:f5:nginx:1.24.0:*:*:*:*:*:*:*");
  assert.equal(cpe(web, "Nginx/1.18.0"), "cpe:2.3:a:f5:nginx:1.18.0:*:*:*:*:*:*:*");
  assert.equal(cpe(web, "Apache 2.4.58 on Debian 12"), "cpe:2.3:a:apache:http_server:2.4.58:*:*:*:*:*:*:*");
  assert.equal(cpe(web, "Apache HTTP Server 2.4.62"), "cpe:2.3:a:apache:http_server:2.4.62:*:*:*:*:*:*:*");
  assert.equal(cpe(web, "httpd 2.4.57"), "cpe:2.3:a:apache:http_server:2.4.57:*:*:*:*:*:*:*");
  assert.equal(cpe(web, "Apache Tomcat 9.0.85 on Windows Server 2022"), "cpe:2.3:a:apache:tomcat:9.0.85:*:*:*:*:*:*:*");
  assert.equal(lookup(web, "nginx 1.24.0 on Ubuntu 22.04").version, "1.24.0");
});

test("unsupported products and unrecognised versions are not looked up", () => {
  const edge = "edge device / firewall";
  // NVD returns nothing for these namings, so a lookup would look like a clean result.
  assert.equal(lookup(edge, "Cisco ASA / Firepower", "9.18.3"), null);
  assert.equal(lookup("web server stack", "IIS 10.0 on Windows Server 2019"), null);
  assert.equal(lookup(edge, "Check Point", "R81.20"), null);
  assert.equal(lookup(edge, "Ubiquiti", "4.0.6"), null);
  assert.equal(lookup(edge, "Acme Firewall 3000", "1.2.3"), null);
  // Version text that isn't a version for this product.
  assert.equal(lookup(edge, "Fortinet FortiGate", "latest"), null);
  assert.equal(lookup(edge, "Fortinet FortiGate", "7"), null);
  assert.equal(lookup(edge, "Palo Alto Networks", "11.1.2-h3; DROP TABLE"), null);
  assert.equal(lookup(edge, "Juniper Networks SRX", "22.4.3"), null);
  assert.equal(lookup(edge, "Fortinet FortiGate", ""), null);
  assert.equal(lookup(edge, "Fortinet FortiGate", undefined), null);
  // Web server text with no version.
  assert.equal(lookup("web server stack", "nginx on Ubuntu"), null);
  // Not a web server answer: a version inside another category isn't guessed at.
  assert.equal(lookup("EDR", "CrowdStrike Falcon 7.10"), null);
});

test("the stated version is kept on the product for labels, trimmed and bounded", () => {
  const p = resolveProduct("edge device / firewall", "Fortinet FortiGate", 0, "  7.4.3  ");
  assert.equal(p.version, "7.4.3");
  assert.equal(resolveProduct("edge device / firewall", "Fortinet FortiGate", 0).version, undefined);
  assert.equal(resolveProduct("web server stack", "nginx 1.24.0 on Ubuntu 22.04", 1).version, "1.24.0");
  assert.equal(resolveProduct("web server stack", "IIS 10.0", 1).version, undefined, "not supported, so no version is claimed as compared");
});
