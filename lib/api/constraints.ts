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
  "AddReactionDto": {
    "emoji": {
      "maxLength": 16
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
  "CallActionDto": {
    "callId": {
      "minLength": 1,
      "maxLength": 100
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
  "CleanupFilesDto": {
    "fileKeys": {
      "minItems": 1,
      "maxItems": 20
    }
  },
  "ConfirmDeliveryDto": {
    "proofId": {
      "pattern": "^c[a-z0-9]{24}$"
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
    }
  },
  "ConfirmWithdrawOtpDto": {
    "otp": {
      "minLength": 6,
      "maxLength": 10
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
  "CreateInquiryDto": {
    "subject": {
      "maxLength": 200
    },
    "message": {
      "maxLength": 1000
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
  "CreateShowcaseCommentDto": {
    "content": {
      "maxLength": 1000
    }
  },
  "CreateShowcaseItemDto": {
    "title": {
      "maxLength": 100
    },
    "description": {
      "maxLength": 500
    },
    "category": {
      "maxLength": 60
    },
    "visibility": {
      "enum": [
        "PUBLIC",
        "PRIVATE"
      ]
    },
    "priceMin": {
      "minimum": 0
    },
    "priceMax": {
      "minimum": 0
    },
    "sortOrder": {
      "minimum": 0
    }
  },
  "CreateShowcaseReportDto": {
    "description": {
      "maxLength": 500
    }
  },
  "CreateTemplateDto": {
    "name": {
      "minLength": 1,
      "maxLength": 50
    },
    "title": {
      "minLength": 1,
      "maxLength": 200
    },
    "description": {
      "maxLength": 2000
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
    "feeResponsibility": {
      "enum": [
        "BUYER",
        "SELLER",
        "SPLIT"
      ]
    },
    "deliveryDeadlineDays": {
      "minimum": 1,
      "maximum": 14
    }
  },
  "CreateTicketDto": {
    "subject": {
      "minLength": 1,
      "maxLength": 200
    },
    "message": {
      "minLength": 1,
      "maxLength": 5000
    },
    "category": {
      "enum": [
        "GENERAL",
        "ORDER",
        "PAYMENT",
        "ACCOUNT",
        "KYC",
        "TECHNICAL",
        "OTHER"
      ]
    },
    "attachments": {
      "maxItems": 5
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
  "DisputeMessageDto": {
    "message": {
      "maxLength": 5000
    },
    "attachments": {
      "maxItems": 5
    }
  },
  "EditMessageDto": {
    "content": {
      "maxLength": 2000
    }
  },
  "Enable2faDto": {
    "code": {
      "minLength": 6,
      "maxLength": 6
    }
  },
  "ForgotPasswordDto": {
    "identifier": {
      "maxLength": 20
    }
  },
  "ForwardMessageDto": {
    "targetRoomIds": {
      "maxItems": 5
    }
  },
  "HideContentDto": {
    "reason": {
      "enum": [
        "SPAM",
        "INAPPROPRIATE",
        "HARASSMENT",
        "OTHER"
      ]
    }
  },
  "LoginDto": {
    "identifier": {
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
  "MigratePhoneConfirmDto": {
    "deviceId": {
      "maxLength": 255
    }
  },
  "MuteRoomDto": {
    "durationHours": {
      "minimum": 1,
      "maximum": 720
    }
  },
  "MutualResolutionProposeDto": {
    "buyerPercent": {
      "minimum": 0,
      "maximum": 100
    },
    "sellerPercent": {
      "minimum": 0,
      "maximum": 100
    },
    "reason": {
      "minLength": 10,
      "maxLength": 2000
    }
  },
  "MutualResolutionRespondDto": {
    "action": {
      "enum": [
        "ACCEPT",
        "REJECT"
      ]
    },
    "responseNote": {
      "maxLength": 2000
    }
  },
  "OtpTriggerRequestDto": {
    "phoneNumber": {
      "maxLength": 20
    },
    "deviceId": {
      "maxLength": 255
    },
    "purpose": {
      "enum": [
        "register",
        "login",
        "forgot_password",
        "migrate_phone"
      ]
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
    "password": {
      "minLength": 8,
      "maxLength": 72
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
        "KYC_PASSPORT",
        "KYC_LIVENESS",
        "BUSINESS_DOCUMENT",
        "SHOWCASE_IMAGE",
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
  "RejectDeliveryDto": {
    "note": {
      "minLength": 10,
      "maxLength": 1000
    },
    "proofId": {
      "pattern": "^c[a-z0-9]{24}$"
    }
  },
  "ReplyTicketDto": {
    "message": {
      "minLength": 1,
      "maxLength": 5000
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
      "minLength": 20,
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
  "RequestPhoneChangeDto": {
    "newPhoneNumber": {
      "maxLength": 20
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
    "newPassword": {
      "minLength": 8,
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
        "FILE",
        "VIDEO",
        "VOICE"
      ]
    },
    "content": {
      "maxLength": 2000
    },
    "durationSeconds": {
      "minimum": 1,
      "maximum": 600
    },
    "caption": {
      "maxLength": 500
    }
  },
  "SetCommentHiddenDto": {
    "reason": {
      "enum": [
        "SPAM",
        "INAPPROPRIATE",
        "HARASSMENT",
        "OTHER"
      ]
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
  "ShowcaseCommentDto": {
    "hiddenReason": {
      "enum": [
        "SPAM",
        "INAPPROPRIATE",
        "HARASSMENT",
        "OTHER",
        null
      ]
    }
  },
  "ShowcaseItemDto": {
    "visibility": {
      "enum": [
        "PUBLIC",
        "PRIVATE"
      ]
    }
  },
  "SocialLoginDto": {
    "provider": {
      "enum": [
        "google",
        "apple"
      ]
    }
  },
  "SubmitBusinessVerificationDto": {
    "businessName": {
      "minLength": 3,
      "maxLength": 150
    },
    "deedNumber": {
      "maxLength": 100
    },
    "siupNumber": {
      "maxLength": 100
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
    "category": {
      "enum": [
        "ITEM_NOT_RECEIVED",
        "ITEM_NOT_AS_DESCRIBED",
        "DAMAGED_ITEM",
        "WRONG_ITEM",
        "SERVICE_NOT_RENDERED",
        "PAYMENT_ISSUE",
        "FRAUD",
        "OTHER"
      ]
    },
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
    "documentType": {
      "enum": [
        "KTP",
        "PASSPORT"
      ]
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
  "TrustDeviceDto": {
    "password": {
      "minLength": 1,
      "maxLength": 128
    },
    "mfaCode": {
      "maxLength": 16
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
  "UpdatePreferencesDto": {
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
  "UpdateShowcaseCommentDto": {
    "content": {
      "maxLength": 1000
    }
  },
  "UpdateShowcaseItemDto": {
    "title": {
      "maxLength": 100
    },
    "description": {
      "maxLength": 500
    },
    "category": {
      "maxLength": 60
    },
    "visibility": {
      "enum": [
        "PUBLIC",
        "PRIVATE"
      ]
    },
    "priceMin": {
      "minimum": 0
    },
    "priceMax": {
      "minimum": 0
    },
    "sortOrder": {
      "minimum": 0
    }
  },
  "UpdateTemplateDto": {
    "name": {
      "minLength": 1,
      "maxLength": 50
    },
    "title": {
      "minLength": 1,
      "maxLength": 200
    },
    "description": {
      "maxLength": 2000
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
    "feeResponsibility": {
      "enum": [
        "BUYER",
        "SELLER",
        "SPLIT"
      ]
    },
    "deliveryDeadlineDays": {
      "minimum": 1,
      "maximum": 14
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
