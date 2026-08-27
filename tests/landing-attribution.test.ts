import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLandingAttribution } from "../src/components/landing/useLandingAttribution.ts";

test("attribution parser returns all UTM fields and decodes values", () => {
  const attribution = parseLandingAttribution(
    "https://www.medidakos.com/landing/catalog?utm_source=cold%20email&utm_medium=email&utm_campaign=august&utm_content=catalog%2Bhero&utm_term=clean%20beauty",
  );

  assert.deepEqual(attribution, {
    utmSource: "cold email",
    utmMedium: "email",
    utmCampaign: "august",
    utmContent: "catalog+hero",
    utmTerm: "clean beauty",
    pageUrl:
      "https://www.medidakos.com/landing/catalog?utm_source=cold%20email&utm_medium=email&utm_campaign=august&utm_content=catalog%2Bhero&utm_term=clean%20beauty",
  });
});

test("missing UTM parameters are omitted rather than exposed as empty strings", () => {
  assert.deepEqual(
    parseLandingAttribution(
      "https://www.medidakos.com/landing/dashboard?utm_content=dashboard",
    ),
    {
      utmContent: "dashboard",
      pageUrl:
        "https://www.medidakos.com/landing/dashboard?utm_content=dashboard",
    },
  );
});

test("attribution parsing does not override the route-selected variant", () => {
  const attribution = parseLandingAttribution(
    "https://www.medidakos.com/landing/dashboard?utm_content=catalog",
  );

  assert.equal(attribution.utmContent, "catalog");
  assert.equal("landingVariant" in attribution, false);
});
