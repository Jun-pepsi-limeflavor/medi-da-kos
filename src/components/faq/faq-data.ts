// FAQ 카테고리·질문·답변 정적 데이터(Figma 'FAQ — Final Design' 290:542 원문 그대로).
// - 카테고리 6개(앵커 id·제목)와 질문 39개. 순서 = 화면 표시 순서
// - id는 고정 딥링크(/faq#faq-001~039): 질문 순서·문구가 바뀌어도 유지, 새 질문은 faq-040부터, 삭제한 id는 재사용하지 않음
// - answer는 문단 배열(Figma 답변의 줄바꿈 = 문단). link는 답변 아래 링크 버튼(Q30 'How it works →')
import { SERVICES_SECTIONS } from "@/lib/config/routes";

export type FaqItem = {
  id: string;
  question: string;
  answer: readonly string[];
  link?: { label: string; href: string };
};

export type FaqCategory = { id: string; title: string; items: readonly FaqItem[] };

/** Figma: Accordion Groups (290:596), Q01–Q39 in category order. */
export const FAQ_CATEGORIES: readonly FaqCategory[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    items: [
      {
        id: "faq-001",
        question: "What information do you need to start product development?",
        answer: [
          "You don't need a finished formula to get started. Share your target market, the products you want to develop, expected order quantity per product, target price range, and desired launch date, and we can begin our review. Benchmark products, a brand introduction, or a product concept are also welcome, as they help us set the right direction faster.",
        ],
      },
      {
        id: "faq-002",
        question: "Can you share a catalog of available products and formulas?",
        answer: [
          "Yes. We can share our product catalog to help you explore available categories and formulation concepts. If you let us know which products or ingredients interest you, we can also help identify suitable development options.",
        ],
      },
      {
        id: "faq-003",
        question: "Are you a manufacturer or a manufacturing project management partner?",
        answer: [
          "We are a cosmetic development and manufacturing partner for global beauty brands. Rather than operating our own factory, we draw on a network of 300+ Korean manufacturers and packaging partners to select the right fit for your product, and lead your project from formulation to export. We oversee development, production timelines, quality checks, and export documentation, so you work with one dedicated team instead of managing multiple suppliers.",
        ],
      },
      {
        id: "faq-004",
        question: "Why work with us instead of contacting Korean manufacturers directly?",
        answer: [
          "You can approach manufacturers directly, but most Korean factories communicate in Korean and prioritize projects with clear specifications and confirmed volumes. Formula manufacturers and packaging suppliers also work separately, so coordinating them from overseas often takes considerable time and trial and error. We turn your brief into a development request manufacturers can act on, match you with suitable manufacturing and packaging partners, and manage everything from samples to export documents through a single point of contact.",
        ],
      },
      {
        id: "faq-005",
        question: "What kind of manufacturers do you work with?",
        answer: [
          "We work with 300+ Korean manufacturers, most of which hold cosmetic quality certifications such as ISO 22716 and CGMP. We select the best fit for each project based on product category, technical capability, and production conditions, and share certificates once the manufacturer for your project is confirmed.",
        ],
      },
      {
        id: "faq-006",
        question: "Can we schedule a meeting or consultation?",
        answer: [
          "Yes. Send us a brief overview of your brand, desired products, and target market, and we'll review it and arrange a meeting. In the first meeting, we discuss your product direction and check whether your expected quantities, budget, and timeline are workable. Follow-up meetings on detailed specifications can be scheduled as needed.",
        ],
      },
      {
        id: "faq-007",
        question: "How long does it take to receive a response to my inquiry?",
        answer: ["We review each inquiry and respond within 5–7 business days."],
      },
      {
        id: "faq-008",
        question: "How do you protect my brand's confidential project information?",
        answer: [
          "We protect your project information through measures such as signing a non-disclosure agreement (NDA). If you have specific confidentiality requirements, please discuss them with us before sharing confidential information.",
        ],
      },
    ],
  },
  {
    id: "product-development",
    title: "Product Development",
    items: [
      {
        id: "faq-009",
        question: "Do you offer ready-made, semi-custom, and full custom ODM formulas?",
        answer: [
          "We can explore different formulation approaches depending on your brand's requirements, including existing formulations, adjustments to available formulas, and custom ODM development. The available options depend on the product category, technical feasibility, and manufacturing partner.",
        ],
      },
      {
        id: "faq-010",
        question: "Can you develop specific textures, ingredients, or claims?",
        answer: [
          "Yes. We can coordinate formulation development based on your preferred ingredients, textures, and product performance goals. Our manufacturing partners will assess technical feasibility, ingredient compatibility, and any testing or regulatory requirements related to your desired claims.",
        ],
      },
      {
        id: "faq-011",
        question: "Can you manufacture sunscreen, eye patches, masks, and makeup?",
        answer: [
          "We work with manufacturing partners across a wide range of skincare and makeup categories, including sunscreen, masks, eye care, and color cosmetics. Product availability and manufacturing feasibility depend on your specific formulation, packaging, and regulatory requirements.",
        ],
      },
      {
        id: "faq-012",
        question: "Who owns the formula developed for my brand?",
        answer: [
          "Formulas developed under ODM or private label arrangements generally belong to the manufacturer. If you want to protect a formula for your brand's exclusive use, options such as an exclusive supply agreement are available, so please let us know during consultation before development begins. We will review suitable arrangements with the manufacturer.",
        ],
      },
      {
        id: "faq-013",
        question: "Can you manufacture a formula I already own?",
        answer: [
          "If you have an existing formula, we can review its specifications and explore manufacturing options in Korea. However, because ingredient sourcing, market regulations, and manufacturing equipment differ, the formula is usually used as a reference and then recreated or adjusted by a Korean manufacturer, rather than transferred as is.",
        ],
      },
      {
        id: "faq-014",
        question: "Do you support clinical testing for product claims?",
        answer: [
          "Yes. Clinical testing is not mandatory for most general cosmetics, but having evidence behind your claims can significantly strengthen trust with consumers and buyers. Some claims, such as SPF, may require testing in your target market. We review the appropriate tests for your product and desired claims and coordinate them with specialized testing institutions. The scope, cost, and timeline are quoted separately for each project.",
        ],
      },
      {
        id: "faq-015",
        question: "Can I request formulation development without mass production?",
        answer: [
          "Manufacturers generally begin formulation work with mass production in mind, so development alone without a production plan is difficult to arrange. If you are planning a production run, we can support you from the development stage onward.",
        ],
      },
      {
        id: "faq-016",
        question: "Can you help with product strategy and formulation direction?",
        answer: [
          "Yes. Based on your requirements and target market, we can propose suitable product concepts, formulations, and ingredients. If you need additional strategy consulting, the scope of support is reviewed for each project.",
        ],
      },
    ],
  },
  {
    id: "moq-pricing",
    title: "MOQ & Pricing",
    items: [
      {
        id: "faq-017",
        question: "What is your minimum order quantity (MOQ), and why is there one?",
        answer: [
          "Our standard minimum order quantity (MOQ) starts at 5,000 units per SKU, but it may vary depending on the minimum order requirements of the selected packaging. For makeup products with multiple shades, the MOQ generally applies to each shade separately. Sheet masks start from 50,000 units due to pouch printing plate production and minimum pouch order requirements. All MOQs may vary by product and manufacturer.",
          "MOQs exist because mass production equipment needs a certain volume per run, and raw and packaging materials such as containers and cartons come with their own minimum purchase units.",
        ],
      },
      {
        id: "faq-018",
        question: "Can I start with a smaller trial order?",
        answer: [
          "In some cases, smaller quantities may be considered depending on the product and manufacturing requirements, although this may result in higher unit costs. Please share your desired quantity so we can review the available options.",
        ],
      },
      {
        id: "faq-019",
        question: "How do you calculate manufacturing prices and quotations?",
        answer: [
          "Quotations are broken down by item: formula manufacturing, packaging (containers, labels and printing, unit cartons, etc.), outer packing (such as shipping cartons), and logistics and shipping. An accurate quotation can be prepared once the prototype specifications, including the packaging configuration and packing bill of materials (BOM), are finalized.",
        ],
      },
      {
        id: "faq-020",
        question: "What are your payment terms and methods?",
        answer: [
          "Deposit and production payment schedules are confirmed according to the terms of each project, and we will share the applicable terms before each stage. We currently accept payments via PayPal and international wire transfer (SWIFT). Please contact our team for the payment options that apply to your project.",
        ],
      },
      {
        id: "faq-021",
        question: "Is there a development fee, and what does it include?",
        answer: [
          "Yes. Development and project management costs are included in your quotation. Our development service covers project planning, formula development and sample review, packaging sourcing, and overall project management. We translate your brief into clear product specifications and manage each stage with our Korean manufacturing and packaging partners. Packaging prototypes, custom molds, testing, regulatory services, and shipping are quoted separately where required.",
        ],
      },
    ],
  },
  {
    id: "samples-packaging",
    title: "Samples & Packaging",
    items: [
      {
        id: "faq-022",
        question: "How can I request product or formula samples?",
        answer: [
          "You can request samples directly from us. We start with a consultation to review your development requirements in detail, including your desired products, formulation needs, and target market. Once confirmed, we send a development request to a suitable manufacturer, and sample production begins. Initial samples typically take 1–2 weeks to prepare, and revised samples usually take around one week. International shipping generally takes an additional 1–2 weeks, with faster courier options available when needed.",
        ],
      },
      {
        id: "faq-023",
        question: "Are samples and international shipping free?",
        answer: [
          "Up to three product samples are provided free of charge in the first sampling round. Shipping fees apply separately and vary by destination country. Additional products beyond the first three are subject to sample fees, which vary by product and are quoted separately. We will confirm the total cost before preparing your samples.",
        ],
      },
      {
        id: "faq-024",
        question: "Can I revise the formula after testing samples?",
        answer: [
          "Yes. After testing your samples, you can share feedback on the texture, ingredients, or product performance, and we will coordinate the requested adjustments with our manufacturing partners. Sample fees generally apply from the second sampling round onward, and any additional development costs will be communicated before proceeding.",
        ],
      },
      {
        id: "faq-025",
        question: "Can I use customized packaging or my own artwork?",
        answer: [
          "Yes. We can coordinate customized packaging options and work with artwork provided by your brand. Packaging feasibility, minimum quantities, and costs depend on the selected materials and specifications. Final artwork files must be confirmed before production.",
        ],
      },
      {
        id: "faq-026",
        question: "Can you source or match a specific packaging type?",
        answer: [
          "Yes. We can help source packaging that matches your desired style, material, or functionality through our partner network. If you have reference images, dimensions, or specific packaging requirements, please share them so we can review suitable options. If no similar packaging is available, new mold development will be required, which may involve additional tooling costs and lead time.",
        ],
      },
      {
        id: "faq-027",
        question: "Do you provide packaging design and branding services?",
        answer: [
          "We coordinate packaging sourcing, customization, and production. Branding and graphic design are not part of our standard service, so brands are expected to provide their own artwork and design files. Brands also write their own on-pack label copy, which we can review.",
        ],
      },
      {
        id: "faq-028",
        question: "Can I choose specific shades when requesting makeup samples?",
        answer: [
          "Yes. You can specify your preferred shades when requesting samples. For a more accurate color match, we recommend sharing color references or benchmark products. We will review color development and sampling options with our manufacturing partner.",
        ],
      },
    ],
  },
  {
    id: "production-process",
    title: "Production Process",
    items: [
      {
        id: "faq-029",
        question: "How long does it take from development to launch?",
        answer: [
          "It generally takes about 5–6 months from the first consultation to a ship-ready product. Mass production itself takes approximately 40–60 days after the packaging and artwork are finalized and the deposit has been paid. The overall timeline may be longer depending on the number of sample revisions, packaging development, additional testing, or special regulatory requirements.",
        ],
      },
      {
        id: "faq-030",
        question: "How does the development-to-delivery process work?",
        answer: [
          "Once you share the details of the product you plan to launch, we begin with a consultation, followed by sampling, packaging selection and formula–packaging compatibility testing, final design and packing specifications, quotation, contract, mass production, and export. For a detailed overview of our development process, please visit our service page.",
        ],
        // Figma: last answer line "How it works →" → Services How It Works (annotation on Q30).
        link: { label: "How it works →", href: SERVICES_SECTIONS.howItWorks },
      },
      {
        id: "faq-031",
        question: "Can I choose the manufacturing partner for my project?",
        answer: [
          "We coordinate suitable manufacturing partners based on product requirements, technical capabilities, and production conditions. If you have a preferred manufacturer, please share the details so we can review the available options.",
        ],
      },
      {
        id: "faq-032",
        question: "Can I visit the manufacturing facility in Korea?",
        answer: [
          "Factory visits may be considered depending on the manufacturer's policies, project status, and scheduling availability. Please contact our team in advance to discuss the possibility.",
        ],
      },
      {
        id: "faq-033",
        question: "How do you ensure product quality and safety during manufacturing?",
        answer: [
          "We coordinate quality requirements and relevant documentation with manufacturing partners throughout the project. Applicable inspections, testing, and quality procedures depend on the product and manufacturer.",
        ],
      },
    ],
  },
  {
    id: "shipping-compliance",
    title: "Shipping & Compliance",
    items: [
      {
        id: "faq-034",
        question: "Which certificates and export documents can you provide?",
        answer: [
          "Depending on the product, manufacturer, and destination market, we can coordinate documentation such as INCI lists, product specifications, COA, SDS/MSDS, certificates of origin, and relevant testing reports. Document availability and requirements vary by project.",
        ],
      },
      {
        id: "faq-035",
        question: "Can you support U.S., EU, and other target-market requirements?",
        answer: [
          "We support the preparation of product documentation and manufacturing information required for target markets, including the U.S. and EU. However, final responsibility for confirming and meeting the regulatory requirements of the target market, such as product registration and labeling, rests with the brand. The scope of documentation support is reviewed for each project, and any additional regulatory services are quoted separately.",
        ],
      },
      {
        id: "faq-036",
        question: "How do export, shipping, and customs work?",
        answer: [
          "We support export documentation, export packing, and the coordination of international shipping. Import customs clearance and local delivery in the destination country are handled by the brand or its designated importer or freight forwarder. The exact division of roles and shipping terms will be confirmed during the project based on the agreed trade terms.",
        ],
      },
      {
        id: "faq-037",
        question: "Can you support vegan, cruelty-free, or other specialty certifications?",
        answer: [
          "Yes. If you need certifications such as vegan or cruelty-free, or a clean beauty positioning, please let us know early in development. Building these criteria in from the ingredient selection stage makes the certification process much smoother. Eligibility, costs, and review procedures vary by product and certifying body and are confirmed separately.",
        ],
      },
      {
        id: "faq-038",
        question: "Will my manufacturing partner's identity be disclosed on my product?",
        answer: [
          "Whether and how manufacturer information appears on your product depends on the destination market and applicable regulations. Label copy is written by the brand, and we can review the draft.",
        ],
      },
      {
        id: "faq-039",
        question: "Can you support products subject to special regulations, such as U.S. OTC sunscreen?",
        answer: [
          "Products subject to special regulations require additional technical review and testing, so development takes longer than for general cosmetics, and the scope of support is reviewed for each project. When we proceed, we support the Korea side, including formulation, required testing such as SPF, and export documentation. For U.S.-side procedures such as product registration, we recommend working with a regulatory specialist in the U.S.",
        ],
      },
    ],
  },
];
