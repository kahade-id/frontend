// GENERATED from docs/api/kahade-api-mobile.json. Run npm run gen:api; do not edit.
export const API_CONSTRAINTS = {
  "AddBankAccountDto": {
    "bankCode": {
      "enum": [
        "BCA",
        "BNI",
        "BRI",
        "MANDIRI",
        "CIMB",
        "PERMATA",
        "DANAMON",
        "OCBC",
        "PANIN",
        "MEGA",
        "BTN",
        "BSI",
        "MAYBANK",
        "OTHER"
      ]
    },
    "bankName": {
      "minLength": 2,
      "maxLength": 100
    },
    "accountNumber": {
      "pattern": "^\\d{6,20}$"
    },
    "accountName": {
      "minLength": 2,
      "maxLength": 100
    }
  },
  "AddCommentDto": {
    "content": {
      "minLength": 1,
      "maxLength": 1000
    }
  },
  "AnswerQuestionDto": {
    "answer": {
      "minLength": 1,
      "maxLength": 2000
    }
  },
  "ApplyReferralDto": {
    "code": {
      "pattern": "^KH[A-Z0-9]{6,8}$"
    }
  },
  "AskQuestionDto": {
    "question": {
      "minLength": 5,
      "maxLength": 500
    }
  },
  "CalculateFeeDto": {
    "orderValue": {
      "minimum": 10000,
      "maximum": 1000000000
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
    },
    "role": {
      "enum": [
        "BUYER",
        "SELLER"
      ]
    }
  },
  "CancelOrderDto": {
    "reason": {
      "enum": [
        "CHANGED_MIND",
        "WRONG_DETAILS",
        "DUPLICATE_ORDER",
        "MUTUAL_AGREEMENT",
        "COUNTERPART_UNRESPONSIVE",
        "OTHER"
      ]
    },
    "note": {
      "maxLength": 500
    }
  },
  "ChangePasswordDto": {
    "currentPassword": {
      "maxLength": 72
    },
    "newPassword": {
      "minLength": 12,
      "maxLength": 72
    },
    "confirmPassword": {
      "minLength": 12,
      "maxLength": 72
    },
    "mfaCode": {
      "maxLength": 16
    }
  },
  "ConfirmOrderDto": {
    "action": {
      "enum": [
        "ACCEPT",
        "REJECT"
      ]
    },
    "reason": {
      "maxLength": 500
    }
  },
  "ConfirmPhoneChangeDto": {
    "newPhoneNumber": {
      "maxLength": 20
    },
    "code": {
      "pattern": "^\\d{6}$"
    }
  },
  "ConfirmWithdrawOtpDto": {
    "otp": {
      "minLength": 6,
      "maxLength": 6
    }
  },
  "CorrectEmailDto": {
    "newEmail": {
      "maxLength": 254
    },
    "password": {
      "maxLength": 72
    },
    "mfaCode": {
      "maxLength": 16
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
  "CreateRatingDto": {
    "stars": {
      "minimum": 1,
      "maximum": 5
    },
    "comment": {
      "maxLength": 500
    }
  },
  "CreateScheduleDto": {
    "dayOfWeek": {
      "minimum": 0,
      "maximum": 6
    },
    "minAmount": {
      "minimum": 1
    }
  },
  "Disable2faDto": {
    "password": {
      "maxLength": 72
    },
    "code": {
      "minLength": 6,
      "maxLength": 16
    },
    "emailOtpCode": {
      "minLength": 6,
      "maxLength": 6
    }
  },
  "Enable2faDto": {
    "code": {
      "minLength": 6,
      "maxLength": 6
    }
  },
  "ForgotPasswordDto": {
    "email": {
      "maxLength": 254
    }
  },
  "LoginDto": {
    "email": {
      "maxLength": 254
    },
    "password": {
      "maxLength": 72
    },
    "deviceId": {
      "maxLength": 255
    },
    "deviceInfo": {
      "maxLength": 512
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
  },
  "RatingReplyDto": {
    "content": {
      "maxLength": 500
    }
  },
  "RegenerateBackupCodesDto": {
    "password": {
      "maxLength": 72
    },
    "code": {
      "minLength": 6,
      "maxLength": 6
    }
  },
  "RegisterDeviceDto": {
    "token": {
      "maxLength": 512
    },
    "platform": {
      "enum": [
        "android",
        "ios",
        "web"
      ]
    },
    "deviceId": {
      "maxLength": 128
    }
  },
  "RegisterDto": {
    "fullName": {
      "minLength": 2,
      "maxLength": 60
    },
    "username": {
      "minLength": 3,
      "maxLength": 30
    },
    "email": {
      "maxLength": 254
    },
    "password": {
      "minLength": 12,
      "maxLength": 72
    },
    "confirmPassword": {
      "minLength": 12,
      "maxLength": 72
    },
    "phoneNumber": {
      "maxLength": 20
    },
    "gender": {
      "enum": [
        "MALE",
        "FEMALE",
        "OTHER",
        "PREFER_NOT_TO_SAY"
      ]
    },
    "referralCode": {
      "maxLength": 20
    }
  },
  "RejectDeliveryDto": {
    "note": {
      "minLength": 10,
      "maxLength": 1000
    }
  },
  "ReportUserDto": {
    "category": {
      "enum": [
        "FRAUD",
        "FAKE_IDENTITY",
        "INAPPROPRIATE_CONTENT",
        "TNC_VIOLATION",
        "MONEY_LAUNDERING",
        "SPAM",
        "OTHER"
      ]
    },
    "description": {
      "minLength": 20,
      "maxLength": 500
    }
  },
  "ReportUserSettingsDto": {
    "category": {
      "enum": [
        "FRAUD",
        "FAKE_IDENTITY",
        "INAPPROPRIATE_CONTENT",
        "TNC_VIOLATION",
        "MONEY_LAUNDERING",
        "SPAM",
        "OTHER"
      ]
    },
    "description": {
      "maxLength": 500
    },
    "evidenceUrls": {
      "maxItems": 10
    }
  },
  "RequestAccountDeletionDto": {
    "reason": {
      "maxLength": 1000
    },
    "mfaCode": {
      "maxLength": 16
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
  "RequestOtpDto": {
    "phoneNumber": {
      "maxLength": 20
    },
    "method": {
      "enum": [
        "SMS",
        "WHATSAPP"
      ]
    },
    "deviceId": {
      "maxLength": 255
    }
  },
  "RequestPhoneChangeDto": {
    "newPhoneNumber": {
      "maxLength": 20
    },
    "method": {
      "enum": [
        "SMS",
        "WHATSAPP"
      ]
    },
    "currentPassword": {
      "minLength": 1,
      "maxLength": 256
    },
    "mfaCode": {
      "maxLength": 16
    }
  },
  "ResendVerificationDto": {
    "email": {
      "maxLength": 254
    }
  },
  "ResetPasswordDto": {
    "email": {
      "maxLength": 254
    },
    "otp": {
      "minLength": 6,
      "maxLength": 6
    },
    "newPassword": {
      "minLength": 12,
      "maxLength": 72
    },
    "confirmPassword": {
      "minLength": 12,
      "maxLength": 72
    }
  },
  "RespondExtensionDto": {
    "action": {
      "enum": [
        "APPROVE",
        "REJECT"
      ]
    },
    "note": {
      "maxLength": 500
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
  "SetPinDto": {
    "pin": {
      "minLength": 6,
      "maxLength": 6
    },
    "currentPin": {
      "minLength": 6,
      "maxLength": 6
    }
  },
  "SetUsernameDto": {
    "username": {
      "minLength": 3,
      "maxLength": 20
    }
  },
  "Setup2faDto": {
    "password": {
      "maxLength": 72
    }
  },
  "SubmitClaimDto": {
    "claim": {
      "minLength": 20,
      "maxLength": 5000
    }
  },
  "SubmitDeliveryProofDto": {
    "description": {
      "minLength": 10,
      "maxLength": 2000
    },
    "fileUrls": {
      "maxItems": 10
    },
    "linkUrls": {
      "maxItems": 5
    }
  },
  "SubmitDisputeDto": {
    "claim": {
      "minLength": 20,
      "maxLength": 2000
    },
    "fileUrls": {
      "minItems": 0,
      "maxItems": 10
    },
    "fileTypes": {
      "maxItems": 10
    }
  },
  "SubmitEvidenceDto": {
    "description": {
      "maxLength": 2000
    },
    "fileUrls": {
      "minItems": 1,
      "maxItems": 10
    },
    "fileTypes": {
      "minItems": 1,
      "maxItems": 10
    }
  },
  "SubmitKycDto": {
    "nik": {
      "pattern": "^\\d{16}$"
    }
  },
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
  "TransferDto": {
    "amount": {
      "minimum": 1000,
      "maximum": 25000000
    }
  },
  "UpdateLanguageDto": {
    "language": {
      "enum": [
        "id",
        "en"
      ]
    }
  },
  "UpdateProfileDto": {
    "fullName": {
      "minLength": 2,
      "maxLength": 60
    },
    "username": {
      "minLength": 3,
      "maxLength": 30
    },
    "bio": {
      "minLength": 0,
      "maxLength": 500
    },
    "accountType": {
      "enum": [
        "PERSONAL",
        "BUSINESS"
      ]
    }
  },
  "UpdateRatingDto": {
    "stars": {
      "minimum": 1,
      "maximum": 5
    },
    "comment": {
      "maxLength": 500
    }
  },
  "UpdateScheduleDto": {
    "dayOfWeek": {
      "minimum": 0,
      "maximum": 6
    },
    "minAmount": {
      "minimum": 1
    }
  },
  "UpdateShippingDto": {
    "trackingNumber": {
      "minLength": 3,
      "maxLength": 100
    },
    "courierName": {
      "minLength": 2,
      "maxLength": 100
    },
    "trackingNotes": {
      "maxLength": 500
    }
  },
  "ValidateCounterpartDto": {
    "username": {
      "minLength": 3,
      "maxLength": 50
    }
  },
  "ValidateVoucherDto": {
    "code": {
      "maxLength": 30
    },
    "orderValue": {
      "minimum": 1
    },
    "userRole": {
      "enum": [
        "BUYER",
        "SELLER"
      ]
    }
  },
  "Verify2faLoginDto": {
    "tempToken": {
      "maxLength": 512
    },
    "code": {
      "minLength": 6,
      "maxLength": 16
    },
    "deviceId": {
      "maxLength": 255
    },
    "deviceInfo": {
      "maxLength": 512
    }
  },
  "VerifyEmailDto": {
    "email": {
      "maxLength": 254
    },
    "otp": {
      "minLength": 6,
      "maxLength": 6
    }
  },
  "VerifyPhoneOtpDto": {
    "phoneNumber": {
      "maxLength": 20
    },
    "deviceId": {
      "maxLength": 255
    },
    "deviceInfo": {
      "maxLength": 512
    }
  },
  "VerifyPinDto": {
    "pin": {
      "minLength": 6,
      "maxLength": 6
    }
  },
  "WithdrawDto": {
    "amount": {
      "minimum": 50000,
      "maximum": 50000000
    }
  }
} as const
