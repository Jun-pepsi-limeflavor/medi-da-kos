// Terms of Service 본문 정적 데이터(Figma 'Terms of Service — Final Design (1440 · desktop)' 549:1057 › Sections 원문 그대로).
// - 12개 조항, 조항 id는 Figma 섹션 이름의 앵커(#terms-…)
// - 문구를 바꾸지 않는다. 추가한 것은 링크뿐: 웹사이트 주소 → Home, 이메일 → mailto, 'Privacy Policy'(3·8조) → Privacy Policy 페이지
// - 시행일·최종 수정일: 2026년 11월 13일(Figma 영문 프레임도 같은 표기로 갱신)
import type { LegalDocumentData } from "@/components/legal/LegalDocument";
import { ROUTES } from "@/lib/config/routes";

const WEBSITE = { text: "https://www.medidakos.com/", href: "/" };
const EMAIL = { text: "support@medidakos.com", href: "mailto:support@medidakos.com" };
const PRIVACY_POLICY_LINK = { text: "Privacy Policy", href: ROUTES.privacy };

export const TERMS_OF_SERVICE: LegalDocumentData = {
  title: "Terms of Service",
  effectiveDate: "November 13, 2026",
  lastUpdated: "November 13, 2026",
  sections: [
    {
      id: "terms-introduction-and-acceptance-of-terms",
      title: "1. Introduction and Acceptance of Terms",
      blocks: [
        { type: "p", text: "Medidakos, a service operated by Korea Technology Asset Co., Ltd. (hereinafter referred to as “we,” “us,” or “our”), provides cosmetic product development and manufacturing-related services." },
        { type: "p", text: "These Terms of Service (hereinafter referred to as the “Terms”) apply to the use of our website, user registration and login, the customer dashboard, consultations, quotations, and project-related services." },
        { type: "field", label: "Legal Entity Name:", value: "Korea Technology Asset Co., Ltd." },
        { type: "field", label: "Website:", value: [WEBSITE] },
        { type: "p", text: "Users may access and use the relevant services by agreeing to these Terms. If users access or use the services on behalf of a company or other organization, they confirm that they have the authority to agree to these Terms on behalf of that organization." },
        { type: "p", text: "The specific terms and conditions of cosmetic product development and manufacturing projects are governed by separate quotations and project agreements." },
      ],
    },
    {
      id: "terms-services-provided",
      title: "2. Services Provided",
      blocks: [
        { type: "p", text: "Medidakos provides services that coordinate and manage the entire cosmetic product development and manufacturing process for global brands." },
        { type: "p", text: "Our services may include the following." },
        {
          type: "list",
          items: [
            "Sourcing and managing cosmetic OEM and ODM manufacturing partners",
            "Coordinating product planning, formulation development, and sample production",
            "Sourcing cosmetic containers and packaging and supporting their development",
            "Supporting production scheduling and quality management",
            "Supporting product certification and regulatory and export-related documentation",
            "Coordinating logistics and shipping-related operations",
            "Managing project progress and customer communications",
          ],
        },
        { type: "p", text: "Actual product manufacturing is carried out by independent manufacturing partners working with us. Medidakos does not operate its own manufacturing facilities and coordinates and manages the development and manufacturing-related activities required for each project in an integrated manner." },
        { type: "p", text: "Information provided on our website regarding products, services, minimum order quantities (MOQ), development timelines, and other matters is intended for general reference, and actual service conditions may vary depending on the project." },
        { type: "p", text: "Products and formulations featured in our portfolio are examples of products that may be developed and are not products sold directly through our website." },
      ],
    },
    {
      id: "terms-user-registration-and-account-management",
      title: "3. User Registration and Account Management",
      blocks: [
        { type: "p", text: "Users may sign up and log in using their email address and password or their Google account." },
        { type: "p", text: "When signing up by email, users are required to provide their name, phone number, country, email address, and password. A company or brand name may be provided optionally." },
        { type: "p", text: "Users must provide accurate information and must not use another person's information without authorization." },
        { type: "p", text: "Members are responsible for keeping their login credentials secure and must notify us if unauthorized account use or security issues occur." },
        { type: "p", text: "Depending on their account permissions and the scope of services provided, members may access project progress, production, and shipping-related information through the customer dashboard." },
        {
          type: "p",
          text: [
            "Members may log out or request account deletion through the customer dashboard. The processing of accounts and personal information upon account deletion is governed by our ",
            PRIVACY_POLICY_LINK,
            " and applicable laws and regulations.",
          ],
        },
        { type: "p", text: "We may restrict access to our services to the extent necessary in cases involving the registration of false information, unauthorized use of another person's account, interference with service operations, or violations of applicable laws and regulations or these Terms." },
      ],
    },
    {
      id: "terms-inquiries-and-project-agreements",
      title: "4. Inquiries and Project Agreements",
      blocks: [
        { type: "p", text: "Submitting consultation or quotation requests or product development-related materials through our website does not, by itself, establish a manufacturing project agreement or confirm an order." },
        { type: "p", text: "Signing up or creating a customer account also does not automatically establish a separate manufacturing agreement." },
        { type: "p", text: "The scope of a project, development and manufacturing conditions, minimum order quantities, costs, schedules, delivery, and other matters are governed by quotations, contracts, purchase orders, or other written documents separately agreed upon between the customer and us." },
        { type: "p", text: "The conditions for commencing product development, sample production, and manufacturing are also subject to the agreements made for each project." },
        { type: "p", text: "Service descriptions and conditions published on our website may change as necessary, and the terms of separately executed project agreements shall take precedence." },
      ],
    },
    {
      id: "terms-customer-responsibilities",
      title: "5. Customer Responsibilities",
      blocks: [
        { type: "p", text: "Customers using our services must comply with the following requirements." },
        {
          type: "list",
          items: [
            "Provide accurate information and materials necessary for consultations, quotations, and project execution.",
            "Hold lawful rights to use the brand names, logos, designs, images, and other materials they submit.",
            "Review and approve specifications, samples, artwork, and other necessary matters related to product development and manufacturing.",
            "Comply with agreed contractual and payment terms.",
            "Review labeling, advertising, and relevant regulatory requirements in the countries where the products are sold and fulfill their responsibilities under the project agreement.",
            "Refrain from using the website or services for unlawful purposes, infringing upon the rights of others, or interfering with service operations.",
          ],
        },
        { type: "p", text: "Project schedules and costs may change due to errors in information or materials provided by the customer, delays in approval, or requests for changes. The specific conditions for handling such matters are governed by the project agreement." },
      ],
    },
    {
      id: "terms-pricing-and-payment",
      title: "6. Pricing and Payment",
      blocks: [
        { type: "p", text: "The costs of product development, samples, packaging, manufacturing, and other services are determined by project-specific quotations and contractual terms." },
        { type: "p", text: "Payment amounts, schedules, deposits, remaining balances, currencies, fees, and payment methods are specified in the relevant quotation or project agreement." },
        { type: "p", text: "Depending on the project conditions, payments related to samples and research and development may be made through PayPal or SWIFT bank transfers, while payments related to mass production are subject to separately agreed bank transfer terms." },
        { type: "p", text: "Additional fees may apply if specification changes, further development, or other work is required at the customer's request during the project." },
        { type: "p", text: "Project cancellation, modifications, and refunds are governed by applicable laws and regulations and the relevant project agreement." },
        { type: "p", text: "Promotions or special offers published on our website are subject to the conditions provided with each promotion." },
      ],
    },
    {
      id: "terms-intellectual-property-rights",
      title: "7. Intellectual Property Rights",
      blocks: [
        { type: "p", text: "Existing intellectual property rights in brand names, logos, designs, images, marketing materials, and other customer materials submitted by customers remain with the respective rights holders." },
        { type: "p", text: "We and the manufacturing and service partners participating in the project may use such materials to the extent necessary to review customer inquiries and perform the project." },
        { type: "p", text: "Ownership and usage rights relating to product formulations, packaging designs, manufacturing technologies, and other project deliverables are governed by the relevant project agreement and contractual terms with manufacturing partners." },
        { type: "p", text: "Text, images, graphics, logos, and other content published on our website are protected by applicable intellectual property laws and may not be reproduced, distributed, or used commercially without prior authorization." },
        { type: "p", text: "When disclosing customer project materials or deliverables for portfolio, marketing, or other promotional purposes, we separately verify the necessary rights or consent." },
      ],
    },
    {
      id: "terms-confidentiality-and-personal-information-protection",
      title: "8. Confidentiality and Personal Information Protection",
      blocks: [
        { type: "p", text: "We handle product concepts, development briefs, quotation-related information, and other non-public project materials provided by customers with reasonable care." },
        { type: "p", text: "Such information may be shared with relevant manufacturing and service partners to the extent necessary to review inquiries and carry out projects." },
        { type: "p", text: "Specific confidentiality obligations are governed by a Non-Disclosure Agreement (NDA) executed between the parties or a separate project agreement." },
        {
          type: "p",
          text: [
            "Personal information collected and processed during user registration, login, and use of our services is protected and managed in accordance with our ",
            PRIVACY_POLICY_LINK,
            " and applicable laws and regulations.",
          ],
        },
      ],
    },
    {
      id: "terms-service-operations-and-liability",
      title: "9. Service Operations and Liability",
      blocks: [
        { type: "p", text: "We strive to maintain stable website operations and provide our services smoothly." },
        { type: "p", text: "However, access to our website and customer dashboard may be temporarily restricted due to system maintenance, technical issues, communication failures, or other unavoidable circumstances." },
        { type: "p", text: "Product development and manufacturing schedules may change depending on raw material availability, manufacturing partners' production capacity, customer approvals, regulatory requirements, and logistics conditions." },
        { type: "p", text: "Specific matters concerning product quality standards, inspections, delivery conditions, manufacturing partners' responsibilities, and project execution are governed by the relevant project agreement." },
        { type: "p", text: "Certifications, registrations, and regulatory approvals are subject to the standards and reviews of the relevant authorities, and we do not guarantee that a particular product will obtain any specific certification or approval." },
        { type: "p", text: "The scope of our liability is governed by applicable laws and regulations and the project agreement. Nothing in these Terms excludes or limits liability that cannot be excluded or limited under applicable laws and regulations." },
      ],
    },
    {
      id: "terms-governing-law-and-dispute-resolution",
      title: "10. Governing Law and Dispute Resolution",
      blocks: [
        { type: "p", text: "These Terms shall be interpreted and governed in accordance with the laws of the Republic of Korea." },
        { type: "p", text: "In the event of a dispute arising from these Terms or the use of our website, we and the user shall first endeavor to resolve the dispute through mutual consultation." },
        { type: "p", text: "If the dispute cannot be resolved through consultation, it shall be resolved by a court having jurisdiction under applicable laws and regulations." },
        { type: "p", text: "Where a separate project agreement contains provisions regarding dispute resolution, those contractual terms shall apply to the extent permitted by applicable laws and regulations." },
      ],
    },
    {
      id: "terms-changes-to-these-terms",
      title: "11. Changes to These Terms",
      blocks: [
        { type: "p", text: "We may amend these Terms in response to changes in applicable laws and regulations, service offerings, or operational policies." },
        { type: "p", text: "The amended Terms will be published on our website, and the Effective Date or Last Updated date will be updated accordingly." },
        { type: "p", text: "Where material changes are made, we will notify users through the methods required by applicable laws and regulations." },
        { type: "p", text: "Existing project agreements remain subject to their respective contractual terms, and changes to these Terms do not automatically modify the terms of previously executed agreements." },
      ],
    },
    {
      id: "terms-contact-information",
      title: "12. Contact Information",
      blocks: [
        { type: "p", text: "For inquiries regarding these Terms, please contact us using the information below." },
        { type: "field", label: "Legal Entity Name:", value: "Korea Technology Asset Co., Ltd." },
        { type: "field", label: "Business Address:", value: "6 Jong-ro, Jongno-gu, Seoul, Republic of Korea" },
        { type: "field", label: "Email:", value: [EMAIL] },
      ],
    },
  ],
};
