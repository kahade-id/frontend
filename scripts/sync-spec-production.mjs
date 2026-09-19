#!/usr/bin/env node
/**
 * Sinkronisasi ONE-TIME spec OpenAPI frontend (docs/api/openapi.json +
 * docs/api/kahade-api-mobile.json) dengan kontrak DTO produksi (release
 * f498385) yang diverifikasi langsung dari source backend di server.
 *
 * Latar: spec yang dipakai generator tipe & check:api-body adalah BASI untuk
 * 11 DTO — dideklarasikan objek kosong padahal produksi menuntut field wajib
 * (CallActionDto.callId, CreateTicketDto.subject/message, dst.). Akibatnya
 * tipe & adapter frontend dikirim `{}`/field salah dan backend menolak 400.
 *
 * Jalankan: node scripts/sync-spec-production.mjs
 */
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const files = [
  resolve(root, "docs/api/openapi.json"),
  resolve(root, "docs/api/kahade-api-mobile.json"),
]

/**
 * Kontrak produksi terverifikasi (sumber: backend/src/modules/** di
 * /var/www/kahade-release-f498385, divalidasi silang dengan curl ke
 * http://localhost:3000 saat audit).
 */
const PRODUCTION = {
  RefreshTokenDto: {
    type: "object",
    properties: {
      refreshToken: {
        type: "string",
        description:
          "Refresh token (jalur cadangan mobile; jalur utama cookie HttpOnly)",
      },
    },
  },
  TrustDeviceDto: {
    type: "object",
    required: ["password"],
    properties: {
      password: {
        type: "string",
        minLength: 1,
        maxLength: 128,
        description: "Current account password",
      },
      mfaCode: {
        type: "string",
        maxLength: 16,
        description: "Authenticator code when 2FA is enabled",
      },
    },
  },
  CleanupFilesDto: {
    type: "object",
    required: ["fileKeys"],
    properties: {
      fileKeys: {
        type: "array",
        minItems: 1,
        maxItems: 20,
        items: { type: "string" },
        description: "Object keys to delete (1-20 items)",
      },
    },
  },
  DisputeMessageDto: {
    type: "object",
    properties: {
      message: { type: "string", maxLength: 5000, description: "Message text" },
      attachments: {
        type: "array",
        maxItems: 5,
        description: "Evidence attachments",
        items: {
          type: "object",
          required: ["fileKey", "fileName", "fileType", "fileSize"],
          properties: {
            fileKey: { type: "string", maxLength: 512 },
            fileName: { type: "string", maxLength: 255 },
            fileType: { type: "string", maxLength: 100 },
            fileSize: { type: "integer", minimum: 1, maximum: 10485760 },
          },
        },
      },
    },
  },
  CallActionDto: {
    type: "object",
    required: ["callId"],
    properties: {
      callId: {
        type: "string",
        minLength: 1,
        maxLength: 100,
        description: "Dispute call ID",
      },
    },
  },
  MutualResolutionProposeDto: {
    type: "object",
    required: ["buyerPercent", "sellerPercent", "reason"],
    properties: {
      buyerPercent: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description: "Persentase kembali ke pembeli",
      },
      sellerPercent: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description: "Persentase ke penjual (total 100)",
      },
      reason: {
        type: "string",
        minLength: 10,
        maxLength: 2000,
        description: "Alasan usulan",
      },
    },
  },
  MutualResolutionRespondDto: {
    type: "object",
    required: ["action"],
    properties: {
      action: { type: "string", enum: ["ACCEPT", "REJECT"] },
      responseNote: {
        type: "string",
        maxLength: 2000,
        description: "Catatan tanggapan (opsional)",
      },
    },
  },
  CreateTemplateDto: {
    type: "object",
    required: ["name", "title", "orderType", "orderValue"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 50 },
      title: { type: "string", minLength: 1, maxLength: 200 },
      description: { type: "string", maxLength: 2000 },
      orderType: {
        type: "string",
        enum: ["PHYSICAL_GOODS", "DIGITAL_GOODS", "SERVICE", "OTHER"],
      },
      orderValue: { type: "number", minimum: 10000, maximum: 1000000000 },
      feeResponsibility: { type: "string", enum: ["BUYER", "SELLER", "SPLIT"] },
      deliveryDeadlineDays: { type: "integer", minimum: 1, maximum: 14 },
      isDefault: { type: "boolean" },
    },
  },
  UpdateTemplateDto: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1, maxLength: 50 },
      title: { type: "string", minLength: 1, maxLength: 200 },
      description: { type: "string", maxLength: 2000 },
      orderType: {
        type: "string",
        enum: ["PHYSICAL_GOODS", "DIGITAL_GOODS", "SERVICE", "OTHER"],
      },
      orderValue: { type: "number", minimum: 10000, maximum: 1000000000 },
      feeResponsibility: { type: "string", enum: ["BUYER", "SELLER", "SPLIT"] },
      deliveryDeadlineDays: { type: "integer", minimum: 1, maximum: 14 },
      isDefault: { type: "boolean" },
    },
  },
  CreateTicketDto: {
    type: "object",
    required: ["subject", "message"],
    properties: {
      subject: {
        type: "string",
        minLength: 1,
        maxLength: 200,
        description: "Judul tiket",
      },
      message: {
        type: "string",
        minLength: 1,
        maxLength: 5000,
        description: "Isi tiket",
      },
      category: {
        type: "string",
        enum: [
          "GENERAL",
          "ORDER",
          "PAYMENT",
          "ACCOUNT",
          "KYC",
          "TECHNICAL",
          "OTHER",
        ],
      },
      orderId: { type: "string", description: "Order terkait" },
      relatedArticleId: {
        type: "string",
        description: "Related help center article ID if user came from FAQ (14.2)",
      },
      attachments: {
        type: "array",
        maxItems: 5,
        items: { type: "string" },
        description: "Attachment file keys (max 5)",
      },
    },
  },
  ReplyTicketDto: {
    type: "object",
    required: ["message"],
    properties: {
      message: {
        type: "string",
        minLength: 1,
        maxLength: 5000,
        description: "Balasan",
      },
    },
  },
  RequestPhoneChangeDto: {
    type: "object",
    required: ["newPhoneNumber", "method", "currentPassword"],
    properties: {
      newPhoneNumber: { type: "string", maxLength: 20 },
      method: { type: "string", enum: ["SMS", "WHATSAPP"] },
      currentPassword: { type: "string", minLength: 1, maxLength: 256 },
      mfaCode: { type: "string", maxLength: 16 },
    },
  },
  ConfirmPhoneChangeDto: {
    type: "object",
    required: ["newPhoneNumber", "code"],
    properties: {
      newPhoneNumber: { type: "string", maxLength: 20 },
      code: { type: "string" },
    },
  },
}

let patched = 0
for (const file of files) {
  const spec = JSON.parse(readFileSync(file, "utf8"))
  const schemas = spec.components?.schemas
  if (!schemas) {
    console.error(`${file}: components.schemas tidak ditemukan — dilewati`)
    continue
  }
  let count = 0
  for (const [name, schema] of Object.entries(PRODUCTION)) {
    if (schemas[name] === undefined) continue
    schemas[name] = schema
    count += 1
  }
  writeFileSync(file, JSON.stringify(spec, null, 2) + "\n")
  patched += count
  console.log(`${file}: ${count} schema DTO disinkronkan`)
}
console.log(`Selesai — total ${patched} schema dipatch.`)
