import { BadRequestException } from "@nestjs/common";
import { CmsFieldType } from "@prisma/client";
import { CmsService } from "./cms.service";
import { PrismaService } from "../prisma/prisma.service";

describe("CmsService dynamic field validation", () => {
  const service = new CmsService({} as PrismaService);
  const validate = (service as unknown as {
    validateAndSplitFields: (input: Record<string, unknown>, fields: Array<Record<string, unknown>>, complete: boolean) =>
      { localizedData: Record<string, unknown>; sharedData: Record<string, unknown> };
  }).validateAndSplitFields.bind(service);
  const fields = [
    { key: "body", type: CmsFieldType.TEXTAREA, isRequired: true, isLocalized: true, isActive: true, config: null },
    { key: "featured", type: CmsFieldType.BOOLEAN, isRequired: false, isLocalized: false, isActive: true, config: null },
    { key: "status", type: CmsFieldType.SELECT, isRequired: true, isLocalized: true, isActive: true, config: { options: ["draft", "ready"] } },
  ];
  it("separates shared and localized values", () => {
    expect(validate({ body: "Hello", featured: false, status: "ready" }, fields, true)).toEqual({
      localizedData: { body: "Hello", status: "ready" },
      sharedData: { featured: false },
    });
  });
  it("rejects fields that are not present in the content schema", () => {
    expect(() => validate({ unexpected: "value" }, fields, false)).toThrow(BadRequestException);
  });
  it("enforces required fields when creating content", () => {
    expect(() => validate({ body: "Hello" }, fields, true)).toThrow("Required field is missing: status");
  });
  it("rejects the wrong value type", () => {
    expect(() => validate({ body: "Hello", featured: "yes", status: "ready" }, fields, true)).toThrow(BadRequestException);
  });
  it("enforces configured select choices", () => {
    expect(() => validate({ body: "Hello", status: "other" }, fields, true)).toThrow(BadRequestException);
  });
});
