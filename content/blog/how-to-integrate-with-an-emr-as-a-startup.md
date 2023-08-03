---
external: false
title: "How to Integrate with an EMR as a Digital Healthcare Startup"
description: "Overcoming Interoperability Challenges in Healthcare: The EMR Integration Journey - In this informative post, the author discusses the critical challenge of interoperability among Electronic Medical Records (EMR) systems within the American healthcare system. The article explores the role of common messaging standards like HL7v2 and FHIR, and the complications that arise due to their inconsistent adoption. The post provides a firsthand perspective on integrating with EMR systems, drawing from the experience at BetterHealthcare. It outlines key requirements such as patience, flexibility, and a willingness to learn, with insights into the technical aspects, like handling HL7 messages. Readers also get a sneak-peek into forthcoming detailed posts about different approaches to send and receive data from an EMR. The blog serves as a valuable resource for healthcare startups and others interested in the intricacies of healthcare data interoperability."
ogImagePath: "https://cdn.damianesteban.dev/pipes.png"
date: 2021-12-11
---

# Introduction

The biggest technical challenge facing the American Healthcare System is the lack of interoperability between EMRs,largely due to the lack of a strong standard protocol. While [HL7v2](https://www.hl7.org/implement/standards/product_brief.cfm?product_id=185) is the most widely used messaging standard among Healthcare systems, it has loose and optional definitions which lead to discrepancies, and many application vendors do not support the latest and best-defined versions of HL7.    

![AI](https://cdn.damianesteban.dev/pipes.png)

[FHIR](https://fhir.org/) is a modern and robust standard that could solve this problem, but adoption is slow. Unless you are working with the major players like [Epic](https://fhir.epic.com/), [Cerner](https://fhir.cerner.com/), [AllScripts](https://developer.allscripts.com/content/fhir/), or a handful of others it is unlikely that FHIR is an option.

At [BetterHealthcare](https://www.betterhealthcare.co) we create solutions for healthcare interoperability. Being integrated with BetterHealthcare means that patients can request accurate appointments that are updated in near real-time, and patient information can be sent back to the EMR. This increases efficiency for our customers, allowing them to effortlessly manage their schedules and intake new patients using our robust set of online tools.


# What is necessary to integrate with an EMR?


1. **Patience**. As a startup, your team is able to move fast and efficiently. Once your project is specced and you have decided on your architecture your team is ready to roll. However, the path to integration with most EMRs is a long one that often involves dealing with many layers of bureaucracy. You’re on their time. 
2. **Flexibility**. This applies to both the technology and the project timeline. The majority of EMRs do not have RESTful APIs, nor do they send data over HTTP. In my experience, the most common solution is the transmission of CSV files over SFTP. HL7v2 transmitted via MLLP is often an option, but if you don't have a Healthcare Integration Engineer on your team this can be challenging. In order to get an integration project started there is usually a security assessment which takes time, and larger companies may want penetration test results performed within the last year.
3. **A willingness to learn**. Even if you do not deal directly with HL7 you must become familiar with the different message types and their content. An excellent resource is Datica Academy's [HL7 Primer](https://datica-2019.netlify.app/academy/hl7-101-a-primer/).

# How do I send and receive data from an EMR?

**Stay tuned, more detailed blog posts will follow about different approaches**. At BetterHealthcare we built a custom integration engine that leverages [AWS Lambda](https://aws.amazon.com/lambda/), Dynamo, and Kinesis as a proxy layer that transforms incoming data into the desired format. There are many potential solutions. Here are a few services I recommend exploring:

1. The [Google Cloud Healthcare API](https://cloud.google.com/healthcare-api/) is a powerful service that allows you to consume and convert HL7v2, FHIR, and DICOM.
2. [Azure FHIR Service](https://docs.microsoft.com/en-us/azure/healthcare-apis/fhir/) is a fully managed FHIR server that you can get running in a few minutes.
3. [FHIR Works on AWS](https://aws.amazon.com/solutions/implementations/fhir-works-on-aws/) is an official AWS Solutions Implementation that leverages AWS Lambda.
4. [Redox Engine](https://www.redoxengine.com/product/) offers EMR integrations with a well-designed standard API. Their services are costly but can be worth the investment. This is your quickest option.
5. [Mirth Connect](https://www.nextgen.com/products-and-services/integration-engine) is a powerful integration engine that allows you to send and receive any type of healthcare data.

# The End

As you may have realized, this article barely scratches the surface of healthcare integration strategies. Expect more content on this topic soon and feel free to reach out to me if you have any questions.


