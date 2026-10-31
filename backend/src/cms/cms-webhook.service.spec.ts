import { PrismaService } from "../prisma/prisma.service";
import { CmsWebhookService, isPublicAddress } from "./cms-webhook.service";

describe("CMS webhook destination safety", () => {
  const service = new CmsWebhookService({} as PrismaService);
  const validateEndpoint = (service as unknown as {
    validateEndpoint: (endpoint: string) => URL;
  }).validateEndpoint.bind(service);

  it.each([
    ["loopback IPv4", "127.0.0.1", false],
    ["private IPv4", "10.20.30.40", false],
    ["link-local IPv4", "169.254.169.254", false],
    ["documentation IPv4", "198.51.100.25", false],
    ["public IPv4", "8.8.8.8", true],
    ["unspecified IPv6", "::", false],
    ["loopback IPv6", "::1", false],
    ["unique-local IPv6", "fd12::1234", false],
    ["link-local IPv6", "fe80::1", false],
    ["multicast IPv6", "ff02::1", false],
    ["IPv4-mapped IPv6", "::ffff:8.8.8.8", false],
    ["documentation IPv6", "2001:db8::1", false],
    ["Teredo transition IPv6", "2001:0::1", false],
    ["6to4 transition IPv6", "2002::1", false],
    ["public Google IPv6", "2001:4860:4860::8888", true],
    ["public Cloudflare IPv6", "2606:4700:4700::1111", true],
    ["malformed address", "not-an-address", false],
  ])("classifies %s (%s)", (_label, address, expected) => {
    expect(isPublicAddress(address)).toBe(expected);
  });

  it("allows only public HTTPS DNS hostnames", () => {
    expect(validateEndpoint("https://hooks.example.com/cms").hostname).toBe("hooks.example.com");
    expect(() => validateEndpoint("http://hooks.example.com/cms")).toThrow("public HTTPS DNS hostname");
    expect(() => validateEndpoint("https://127.0.0.1/cms")).toThrow("public HTTPS DNS hostname");
    expect(() => validateEndpoint("https://metadata.google.internal/")).toThrow("public HTTPS DNS hostname");
    expect(() => validateEndpoint("https://user:pass@hooks.example.com/")).toThrow("public HTTPS DNS hostname");
  });
});
