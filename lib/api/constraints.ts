// GENERATED from docs/api/kahade-api-mobile.json. Run npm run gen:api; do not edit.
export const API_CONSTRAINTS = {
  "SubscribeDto": {
    "plan": {
      "enum": [
        "MONTHLY",
        "ANNUAL"
      ]
    },
    "paymentMethod": {
      "enum": [
        "VIRTUAL_ACCOUNT_BCA",
        "VIRTUAL_ACCOUNT_BNI",
        "VIRTUAL_ACCOUNT_BRI",
        "VIRTUAL_ACCOUNT_MANDIRI",
        "VIRTUAL_ACCOUNT_CIMB",
        "VIRTUAL_ACCOUNT_PERMATA",
        "VIRTUAL_ACCOUNT_OTHER",
        "QRIS",
        "GOPAY",
        "SHOPEEPAY",
        "OVO",
        "DANA",
        "LINKAJA",
        "CREDIT_CARD",
        "ALFAMART",
        "INDOMARET",
        "AKULAKU",
        "KREDIVO",
        "KAHADE_WALLET"
      ]
    }
  },
  "TopupDto": {
    "amount": {
      "minimum": 10000,
      "maximum": 50000000
    },
    "method": {
      "enum": [
        "VIRTUAL_ACCOUNT_BCA",
        "VIRTUAL_ACCOUNT_BNI",
        "VIRTUAL_ACCOUNT_BRI",
        "VIRTUAL_ACCOUNT_MANDIRI",
        "VIRTUAL_ACCOUNT_CIMB",
        "VIRTUAL_ACCOUNT_PERMATA",
        "VIRTUAL_ACCOUNT_OTHER",
        "QRIS",
        "GOPAY",
        "SHOPEEPAY",
        "OVO",
        "DANA",
        "LINKAJA",
        "CREDIT_CARD",
        "ALFAMART",
        "INDOMARET",
        "AKULAKU",
        "KREDIVO"
      ]
    }
  },
  "WithdrawDto": {
    "amount": {
      "minimum": 50000,
      "maximum": 50000000
    }
  },
  "TransferDto": {
    "amount": {
      "minimum": 1000,
      "maximum": 25000000
    }
  },
  "CreateOrderDto": {
    "role": {
      "enum": [
        "BUYER",
        "SELLER"
      ]
    },
    "counterpartUsername": {
      "minLength": 3,
      "maxLength": 50
    },
    "title": {
      "minLength": 3,
      "maxLength": 100
    },
    "description": {
      "minLength": 10,
      "maxLength": 500
    },
    "orderType": {
      "enum": [
        "PHYSICAL_GOODS",
        "DIGITAL_GOODS",
        "SERVICE",
        "OTHER"
      ]
    },
    "orderValue": {
      "minimum": 10000,
      "maximum": 1000000000
    },
    "deliveryDeadlineDays": {
      "minimum": 1,
      "maximum": 14
    },
    "feeResponsibility": {
      "enum": [
        "BUYER",
        "SELLER",
        "SPLIT"
      ]
    },
    "voucherCode": {
      "maxLength": 50
    }
  },
  "CreateOrderLinkDto": {
    "role": {
      "enum": [
        "BUYER",
        "SELLER"
      ]
    },
    "title": {
      "minLength": 3,
      "maxLength": 100
    },
    "description": {
      "minLength": 10,
      "maxLength": 500
    },
    "orderType": {
      "enum": [
        "PHYSICAL_GOODS",
        "DIGITAL_GOODS",
        "SERVICE",
        "OTHER"
      ]
    },
    "orderValue": {
      "minimum": 10000,
      "maximum": 1000000000
    },
    "deliveryDeadlineDays": {
      "minimum": 1,
      "maximum": 14
    },
    "feeResponsibility": {
      "enum": [
        "BUYER",
        "SELLER",
        "SPLIT"
      ]
    },
    "counterpartUsername": {
      "maxLength": 50
    }
  },
  "RequestExtensionDto": {
    "extensionDays": {
      "minimum": 1,
      "maximum": 14
    },
    "reason": {
      "minLength": 10,
      "maxLength": 500
    }
  },
  "PhoneRegisterDto": {
    "fullName": {
      "minLength": 2,
      "maxLength": 60
    },
    "username": {
      "minLength": 3,
      "maxLength": 30
    },
    "gender": {
      "enum": [
        "MALE",
        "FEMALE",
        "OTHER",
        "PREFER_NOT_TO_SAY"
      ]
    },
    "email": {
      "maxLength": 254
    },
    "password": {
      "minLength": 12,
      "maxLength": 72
    },
    "pin": {
      "minLength": 6,
      "maxLength": 6
    },
    "address": {
      "maxLength": 500
    },
    "referralCode": {
      "maxLength": 20
    },
    "deviceId": {
      "maxLength": 255
    }
  },
  "SendMessageDto": {
    "messageType": {
      "enum": [
        "TEXT",
        "IMAGE",
        "FILE"
      ]
    },
    "content": {
      "maxLength": 2000
    }
  },
  "BatchNotificationIdsDto": {},
  "PresignedUrlDto": {
    "purpose": {
      "enum": [
        "KYC_KTP",
        "KYC_SELFIE",
        "AVATAR",
        "CHAT_ATTACHMENT",
        "DISPUTE_EVIDENCE",
        "REPORT_EVIDENCE",
        "DELIVERY_PROOF"
      ]
    }
  }
} as const
