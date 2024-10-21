interface AuditIssue {
    title: string
    description: string
    solution: string
    type: "error" | "warning" | "notice"
}

export const SEMRUSH_API_KEY = "semrushApiKey"

export const AUDIT_ISSUES: Record<number, AuditIssue> = {
    1: {
        title: "Pages returning 5XX status code",
        type: "error",
        description:
            "5xx errors refer to problems with a server being unable to perform the request from a user or a crawler. They prevent users and search engine robots from accessing your webpages, and can negatively affect user experience and search engines' crawlability. This will in turn lead to a drop in traffic driven to your website.",
        solution: "Investigate the causes of these errors and fix them.",
    },
    3: {
        title: "Pages don't have title tags",
        type: "error",
        description:
            "A &lt;title&gt; tag is a key on-page SEO element. It appears in browsers and search results and helps both search engines and users understand what your page is about.<br>\nIf a page is missing a title, or a &lt;title&gt; tag is empty, Google may consider it low quality. In case you promote this page in search results, you will miss chances to rank high and gain a higher click-through rate.",
        solution:
            'Ensure that every page on your website has a unique and concise title containing your most important keywords. For information on how to create effective titles, please <a href="https://support.google.com/webmasters/answer/35624" rel="nofollow" target="_blank">see this Google article</a>. You can also view the On-Page SEO Basics: <a href="https://www.semrush.com/blog/on-page-seo-basics-meta-descriptions/" rel="nofollow" target="_blank">Meta Descriptions article</a>.',
    },
    6: {
        title: "Issues with duplicate title tags",
        description:
            "Our crawler reports pages that have duplicate title tags only if they are exact matches. Duplicate &lt;title&gt; tags make it difficult for search engines to determine which of a website's pages is relevant for a specific search query, and which one should be prioritized in search results. Pages with duplicate titles have a lower chance of ranking well and are at risk of being banned. Moreover, identical &lt;title&gt; tags confuse users as to which webpage they should follow.",
        solution:
            'Provide a unique and concise title for each of your pages that contains your most important keywords. For information on how to create effective titles, please <a href="https://support.google.com/webmasters/answer/35624" rel="nofollow" target="_blank">see this Google article</a>. You can also view the On-Page SEO Basics: <a href="https://www.semrush.com/blog/on-page-seo-basics-meta-descriptions/" rel="nofollow" target="_blank">Meta Descriptions article</a>.',
        type: "error",
    },
    7: {
        title: "Pages with duplicate content issues",
        type: "error",
        description:
            "Webpages are considered duplicates if their content is 85% identical. Having duplicate content may significantly affect your SEO performance. First of all, Google will typically show only one duplicate page, filtering other instances out of its index and search results, and this page may not be the one you want to rank.<br>\nIn some cases, search engines may consider duplicate pages as an attempt to manipulate search engine rankings, and, as a result, your website may be downgraded or even banned from search results. Moreover, duplicate pages may dilute your link profile.",
        solution:
            'Here are a few ways to fix duplicate content issues:<br>\n- Add a rel="canonical" link to one of your duplicate pages to inform search engines which page to show in search results<br>\n- Use a 301 redirect from a duplicate page to the original one<br>\n- Use a rel="next" and a rel="prev" link attribute to fix pagination duplicates<br>\n- Instruct GoogleBot to handle URL parameters differently using Google Search Console<br>\n- Provide some unique content on the webpage<br>\nFor more information, please read these Google articles: <a href="https://support.google.com/webmasters/answer/66359?hl=en" rel="nofollow" target="_blank">"Duplicate content"</a> and <a href="https://support.google.com/webmasters/answer/139066?hl=en" rel="nofollow" target="_blank">"Consolidate duplicate URLs"</a>.',
    },
    8: {
        title: "Broken internal links",
        type: "error",
        description:
            "Broken internal links lead users from one website to another and bring them to non-existent webpages. Multiple broken links negatively affect user experience and may worsen your search engine rankings because crawlers may think that your website is poorly maintained or coded.<br>\nPlease note that our crawler may detect a working link as broken. Generally, this happens if the server hosting the website you're referring to blocks our crawler from accessing this website.",
        solution:
            "Please follow all links reported as broken. If a target webpage returns an error, remove the link leading to the error page or replace it with another resource.<br>\nIf the links reported as broken do work when accessed with a browser, you should contact the website's owner and inform them about the issue.",
    },
    10: {
        title: "Pages couldn't be crawled (DNS resolution issues)",
        type: "error",
        description:
            "A DNS resolution error is reported when our crawler can't resolve the hostname when trying to access your webpage.",
        solution: "Please contact your web hosting technical support and ask them to investigate and fix the issue.",
    },
    9: {
        title: "Pages couldn't be crawled (incorrect URL formats)",
        type: "error",
        description:
            "This issue indicates that our crawler couldn't access the webpage. There are two possible reasons:<br>\n- Your site's server response time is more than 5 seconds<br>\n- Your server refused access to your webpages",
        solution:
            "Make sure your page's URL conforms to a standard scheme and doesn't have any unnecessary characters or typos.",
    },
    13: {
        title: "Broken internal images",
        type: "error",
        description:
            "An internal broken image is an image that can't be displayed because it no longer exists, its URL is misspelled, or because the file path is not valid. Broken images may jeopardize your search rankings because they provide a poor user experience and signal to search engines that your page is low quality.",
        solution:
            "To fix a broken internal image, perform one of the following:<br>\n- If an image is no longer located in the same location, change its URL<br>\n- If an image was deleted or damaged, replace it with a new one<br>\n- If an image is no longer needed, simply remove it from your page's code",
    },
    15: {
        title: "Pages with duplicate meta descriptions",
        type: "error",
        description:
            "Our crawler reports pages that have duplicate meta descriptions only if they are exact matches.<br>\nA &lt;meta description&gt; tag is a short summary of a webpage's content that helps search engines understand what the page is about and can be shown to users in search results.<br>\nDuplicate meta descriptions on different pages mean a lost opportunity to use more relevant keywords. Also, duplicate meta descriptions make it difficult for search engines and users to differentiate between different webpages. It is better to have no meta description at all than to have a duplicate one.",
        solution:
            'Provide a unique, relevant meta description for each of your webpages.<br>\nFor information on how to create effective meta descriptions, please see <a href="https://support.google.com/webmasters/answer/35624" rel="nofollow" target="_blank">this Google article</a>.<br>\nYou can also view the On-Page SEO Basics: <a href="https://www.semrush.com/blog/on-page-seo-basics-meta-descriptions/" rel="nofollow" target="_blank">Meta Descriptions article</a>.',
    },
    16: {
        title: "Format errors in Robots.txt file",
        type: "error",
        description:
            "If your robots.txt file is poorly configured, it can cause you a lot of problems.<br>\nWebpages that you want to be promoted in search results may not be indexed by search engines, while some of your private content may be exposed to users.<br>\nSo, one configuration mistake can damage your search rankings, ruining all your search engine optimization efforts.",
        solution:
            'Review your robots.txt file and fix all errors, if there are any.<br>\nYou can check your file using <a href="https://www.google.com/webmasters/tools/robots-testing-tool" rel="nofollow" target="_blank">Google\'s robots.txt Tester</a>.<br>\nFor information on how to configure your robots.txt, please see <a href="https://developers.google.com/search/reference/robots_txt" rel="nofollow" target="_blank">this article</a>.',
    },
    17: {
        title: "Format errors in sitemap.xml files",
        type: "error",
        description:
            "If your sitemap.xml file has any errors, search engines will not be able to process the data it contains, and they will ignore it.",
        solution:
            'Review your sitemap.xml file and fix all errors.<br>\nYou can check your file using the Sitemaps report in <a href="https://search.google.com/search-console/not-verified?original_url=/search-console/sitemaps&amp;original_resource_id" rel="nofollow" target="_blank">Google Search Console</a>.<br>\nFor information on how to configure your sitemap.xml, please see<a href="https://www.sitemaps.org/protocol.html" rel="nofollow" target="_blank"> this article</a>.',
    },
    18: {
        title: "Incorrect pages found in sitemap.xml",
        type: "error",
        description:
            "A sitemap.xml file makes it easier for crawlers to discover the pages on your website. Only good pages intended for your visitors should be included in your sitemap.xml file.<br>\nThis error is triggered if your sitemap.xml contains URLs that:<br>\n- lead to webpages with the same content<br>\n- redirect to a different webpage<br>\n- return non-200 status code<br>\nPopulating your file with such URLs will confuse search engines, cause unnecessary crawling or may even result in your sitemap being rejected.",
        solution:
            "Review your sitemap.xml for any redirected, non-canonical or non-200 URLs. Provide the final destination URLs that are canonical and return a 200 status code.",
    },
    19: {
        title: "Pages with a WWW resolve issue",
        type: "error",
        description:
            "Normally, a webpage can be accessed with or without adding www to its domain name. If you haven’t specified which version should be prioritized, search engines will crawl both versions, and the link juice will be split between them. Therefore, none of your page versions will get high positions in search results.",
        solution:
            'Specify which version of your webpage you want to be the main one. Use Google Search Console data to define pages that are indexed. We recommend that you redirect an alternate version of your page to the preferred version via a 301 redirect. For more information, please see the <a href="https://developers.google.com/search/docs/advanced/crawling/consolidate-duplicate-urls?visit_id=637691140006114086-295375402&amp;rd=1" rel="nofollow" target="_blank">Consolidate duplicate URLs </a>article.',
    },
    20: {
        title: "Pages with no viewport tag",
        type: "error",
        description:
            'The viewport meta tag is an HTML tag that allows you to control a page\'s viewport size and scale on mobile devices. This tag is indispensable if you want to make your website accessible and optimized for mobile devices.<br>\nFor more information about the viewport meta tag, please see <a href="https://developers.google.com/web/fundamentals/design-and-ux/responsive/" rel="nofollow" target="_blank">the Responsive Web Design Basics article</a>.',
        solution:
            "Set the viewport meta tag for each page, and then test your website on a mobile device to make sure everything works fine.",
    },
    21: {
        title: "Size of HTML on a page is too large",
        type: "error",
        description:
            "A webpage’s HTML size is the size of all HTML code contained in it. A page size that is too large (i.e., exceeding 2 MB) leads to a slower page load time, resulting in a poor user experience and a lower search engine ranking.",
        solution:
            "Review your page’s HTML code and consider optimizing its structure and/or removing inline scripts and styles.",
    },
    22: {
        title: "AMP pages with no canonical tag",
        type: "error",
        description:
            'This issue is triggered if your AMP page has no canonical tag.<br>\nWhen creating AMP pages, several requirements should be met:<br>\n- If you have both an AMP and a non-AMP version of the same page, you should place canonical tags on both versions to prevent duplicate content issues<br>\n- If you have only an AMP version of your webpage, it must have a self-referential canonical tag<br>\nFor more information, please see these articles: <a href="https://support.google.com/webmasters/answer/6340290?hl=en#discovery" rel="nofollow" target="_blank">AMP on Google Search guidelines</a> and <a href="https://www.semrush.com/blog/fixing-amp-validation-errors/" rel="nofollow" target="_blank">ABC of Fixing AMP Validation Errors With Semrush</a>',
        solution: 'Add a rel="canonical" tag in the &lt;head&gt; section of each AMP page.',
    },
    2: {
        title: "Pages returning 4XX status code",
        type: "error",
        description:
            "A 4xx error means that a webpage cannot be accessed. This is usually the result of broken links. These errors prevent users and search engine robots from accessing your webpages, and can negatively affect both user experience and search engine crawlability. This will in turn lead to a drop in traffic driven to your website. Please be aware that the crawler may detect a working link as broken if your website blocks our crawler from accessing it. This usually happens due to the following reasons:<br>\n- DDoS protection system<br>\n- Overloaded or misconfigured server",
        solution:
            'If a webpage returns an error, remove all links leading to the error page or replace it with another resource.<br>\nTo identify all pages on your website that contain links to a 4xx page, click "View broken links" next to the error page.<br>\nIf the links reported as 4xx do work when accessed with a browser, you can try either of the following:<br>\n- Contact your web hosting support team<br>\n- Instruct search engine robots not to crawl your website too frequently by specifying the "crawl-delay" directive in your robots.txt',
    },
    26: {
        title: "Non-secure pages",
        type: "error",
        description:
            'This issue is triggered if our crawler detects an HTTP page with a &lt;input type="password"&gt; field.<br>\nUsing a &lt;input type="password"&gt; field on your HTTP page is harmful to user security, as there is a high risk that user login credentials can be stolen. To protect users\' sensitive information from being compromised, Google Chrome will start informing users about the dangers of submitting their passwords on HTTP pages by labeling such pages as "non-secure" starting January 2017. This could have a negative impact on your bounce rate, as users will most likely feel uncomfortable and leave your page as quickly as possible.',
        solution:
            'Move your HTTP webpages that contain a password field to HTTPS. Please follow these <a href="https://support.google.com/webmasters/answer/6033049" rel="nofollow" target="_blank">Google guidelines</a>.',
    },
    27: {
        title: "Issues with expiring or expired certificate",
        type: "error",
        description:
            "This issue is triggered if your certificate has expired or will expire soon.<br>\nIf you allow your certificate to expire, users accessing your website will be presented with a warning message, which usually stops them from going further and may lead to a drop in your organic search traffic.",
        solution:
            "Ask your website administrator to renew the certificate and run periodic checks to avoid any future issues.",
    },
    28: {
        title: "Issues with old security protocol",
        type: "error",
        description:
            "Running SSL or old TLS protocol (version 1.0) is a security risk, which is why it is strongly recommended that you implement the newest protocol versions.",
        solution: "Update your security protocol to the latest version.",
    },
    29: {
        title: "Issues with incorrect certificate name",
        type: "error",
        description:
            "If the domain or subdomain name to which your SSL certificate is registered doesn't match the name displayed in the address bar, web browsers will block users from visiting your website by showing them a name mismatch error, and this will in turn negatively affect your organic search traffic.",
        solution:
            "Contact your website administrator and ask them to install the correct certificate.<br>\nSince subdomains also require their own certificates, you can use a wildcard or multi-domain SSL certificate that allows you to secure multiple subdomains.",
    },
    30: {
        title: "Issues with mixed content",
        type: "error",
        description:
            "If your website contains any elements that are not secured with HTTPS, this may lead to security issues. Moreover, browsers will warn users about loading unsecure content, and this may negatively affect user experience and reduce their confidence in your website.",
        solution:
            "Only embed HTTPS content on HTTPS pages.<br>\nReplace all HTTP links with the new HTTPS versions. If there are any external links leading to a page that has no HTTPS version, remove those links.",
    },
    32: {
        title: "No redirect or canonical to HTTPS homepage from HTTP version",
        type: "error",
        description:
            "If you're running both HTTP and HTTPS versions of your homepage, it is very important to make sure that their coexistence doesn't impede your SEO. Search engines are not able to figure out which page to index and which one to prioritize in search results. As a result, you may experience a lot of problems, including pages competing with each other, traffic loss, and poor placement in search results. To avoid these issues, you must instruct search engines to only index the HTTPS version.",
        solution:
            'Do either of the following:<br>\n- Redirect your HTTP page to the HTTPS version via a 301 redirect<br>\n- Mark up your HTTPS version as the preferred one by adding a rel="canonical" to your HTTP pages',
    },
    33: {
        title: "Redirect chains and loops",
        type: "error",
        description:
            "Redirecting one URL to another is appropriate in many situations. However, if redirects are done incorrectly, it can lead to disastrous results. Two common examples of improper redirect usage are redirect chains and loops.Long redirect chains and infinite loops lead to a number of problems that can damage your SEO efforts. They make it difficult for search engines to crawl your site, which affects your crawl budget usage and how well your webpages are indexed, slows down your site's load speed, and, as a result, may have a negative impact on your rankings and user experience.Please note that if you can’t spot a redirect chain with your browser, but it is reported in your Site Audit report, your website probably responds to crawlers’ and browsers’ requests differently, and you still need to fix the issue.",
        solution:
            "The best way to avoid any issues is to follow one general rule: do not use more than three redirects in a chain.If you are already experiencing issues with long redirect chains or loops, we recommend that you redirect each URL in the chain to your final destination page.We do not recommend that you simply remove redirects for intermediate pages as there can be other links pointing to your removed URLs, and, as a result, you may end up with 404 errors.",
    },
    34: {
        title: "AMP HTML issues",
        type: "error",
        description:
            "In order for AMP pages to be served properly to mobile users, they must be compliant with AMP guidelines.<br>\nIf your HTML doesn't adhere to AMP standards, your AMP page will not work correctly, and may not be indexed by search engines, and, as a result, may not appear in mobile search results.",
        solution:
            'Since there are multiple reasons why your page\'s HTML may not comply with AMP standards, we provide specific how-to-fix tips for each invalid AMP page. These tips are provided in the \'Issue Description\' column on the page that lists all pages with HTML issues.<br>\nYou can also check out the <a href="https://www.semrush.com/blog/fixing-amp-validation-errors/" rel="nofollow" target="_blank">ABC of Fixing AMP Validation Errors With Semrush</a> article to get more information.',
    },
    35: {
        title: "AMP style and layout issues",
        type: "error",
        description:
            "In order for AMP pages to be served properly to mobile users, they must be compliant with AMP guidelines.<br>\nIf the style and layout of your AMP page do not adhere to AMP standards, the page will not work correctly, and may not be indexed by search engines, and, as a result, may not appear in mobile search results.",
        solution:
            'Since there are multiple reasons why your page\'s style and layout may not comply with AMP standards, we provide specific how-to-fix tips for each invalid AMP page. These tips are provided in the \'Issue Description\' column on the page that lists all pages with style and layout issues.<br>\nYou can also check out the <a href="https://www.semrush.com/blog/fixing-amp-validation-errors/" rel="nofollow" target="_blank">ABC of Fixing AMP Validation Errors With Semrush</a> article to get more information.',
    },
    36: {
        title: "AMP templating issues",
        type: "error",
        description:
            "In order for AMP pages to be served properly to mobile users, they must be compliant with AMP guidelines.<br>\nIf your AMP page includes templating syntax, it will not work correctly and may not be indexed by search engines, and, as a result, may not appear in mobile search results.",
        solution:
            'Since there are different types of templating issues that your AMP page can have, we provide specific how-to-fix tips for each invalid AMP page. These tips are provided in the \'Issue Description\' column on the page that lists all pages with templating issues.<br>\nYou can also check out the <a href="https://www.semrush.com/blog/fixing-amp-validation-errors/" rel="nofollow" target="_blank">ABC of Fixing AMP Validation Errors With Semrush</a> article to get more information.',
    },
    38: {
        title: "Pages with a broken canonical link",
        type: "error",
        description:
            'By setting a rel="canonical" element on your page, you can inform search engines of which version of a page you want to show up in search results. When using canonical tags, it is important to make sure that the URL you include in your rel="canonical" element leads to a page that actually exists. Canonical links that lead to non-existent webpages complicate the process of crawling and indexing your content and, as a result, decrease crawling efficiency and lead to unnecessary crawl budget waste.',
        solution:
            "Review all broken canonical links. If a canonical URL applies to a non-existent webpage, remove it or replace it with another resource.",
    },
    39: {
        title: "Pages with multiple canonical URLs",
        type: "error",
        description:
            "Multiple rel=”canonical” tags with different URLs specified for the same page confuse search engines and make it almost impossible for them to identify which URL is the actual canonical page. As a result, search engines will likely ignore all the canonical elements or pick the wrong one. That’s why it is recommended that you specify no more than one rel=”canonical” for a page.",
        solution: "Remove all canonical URLs except the one that you’d like to serve as the actual canonical page.",
    },
    40: {
        title: "Pages with a meta refresh tag",
        type: "error",
        description:
            "A meta refresh tag instructs a web browser to redirect a user to a different page after a given interval. Generally, it is recommended that you avoid using a meta refresh tag as it is considered a poor, slow, and outdated technique that may lead to SEO and usability issues.",
        solution:
            "Review all pages with a meta refresh tag. If this tag is used to redirect an old page to a new one, replace it with a 301 redirect.",
    },
    41: {
        title: "Issues with broken internal JavaScript and CSS files",
        type: "error",
        description:
            "A broken JavaScript or CSS file is an issue that should be watched out for on your website. Any script that has stopped running on your website may jeopardize your rankings, since search engines will not be able to properly render and index your webpages. Moreover, broken JS and CSS files may cause website errors, and this will certainly spoil your user experience.",
        solution: "Review all broken JavaScript and CSS files hosted on your website and fix any issues.",
    },
    42: {
        title: "Subdomains don’t support secure encryption algorithms",
        type: "error",
        description:
            "This issue is triggered when we connect to your web server and detect that it uses old or deprecated encryption algorithms. Using outdated encryption algorithms is a security risk that can have a negative impact on your user experience and search traffic. Some web browsers may warn users accessing your website about loading insecure content. This usually negatively affects their confidence in your website, thereby stopping them from going further, and as a result, you may experience a drop in your organic search traffic.",
        solution: "Contact your website administrator and ask them to update encryption algorithms.",
    },
    43: {
        title: "Sitemap.xml files are too large",
        type: "error",
        description:
            "This issue is triggered if the size of your sitemap.xml file (uncompressed) exceeds 50 MB or it contains more than 50,000 URLs. Sitemap files that are too large will put your site at risk of being ineffectively crawled or even ignored by search engines.",
        solution:
            'Break up your sitemap into smaller files. You will also need to create a sitemap index file to list all your sitemaps and submit it to Google.<br>\nDon\'t forget to specify the location of your new sitemap.xml files in your robots.txt.<br>\nFor more details, see <a href="https://support.google.com/webmasters/answer/183668?hl=en" rel="nofollow" target="_blank">this Google article</a>.',
    },
    111: {
        title: "Pages with slow load speed",
        type: "error",
        description:
            'Page (HTML) load speed is one of the most important ranking factors. The quicker your page loads, the higher the rankings it can receive. Moreover, fast-loading pages positively affect user experience and may increase your conversion rates.<br>\nPlease note that "page load speed" usually refers to the amount of time it takes for a webpage to be fully rendered by a browser. However, the crawler only measures the time it takes to load a webpage’s HTML code - load times for images, JavaScript, and CSS are not factored in.',
        solution:
            "The main factors that negatively affect your HTML page generation time are your server’s performance and the density of your webpage’s HTML code.<br>\nSo, try to clean up your webpage’s HTML code. If the problem is with your web server, you should think about moving to a better hosting service with more resources.",
    },
    45: {
        title: "Invalid structured data items",
        type: "error",
        description:
            'This issue is triggered if structured data items contain fields that do not meet <a href="https://developers.google.com/search/docs/data-types/article" rel="nofollow" target="_blank">Google\'s guidelines</a>.Implementing and maintaining your structured data correctly is important if you want to get an edge over your competitors in search results.If your website markup has errors, crawlers will not be able to properly understand it, and you may run the risk of losing the chance of gaining rich snippets and getting more favorable rankings.For more information on the structured data requirements, see <a href="https://schema.org/" rel="nofollow" target="_blank">schema.org</a>, <a href="https://developers.google.com/search/docs/data-types/article" rel="nofollow" target="_blank">Google documentation</a>, or <a href="https://www.semrush.com/kb/1084-structured-data-items-site-audit" target="_blank">our article</a>.',
        solution:
            'Check structured data on your webpages with a validation tool. Please note that different markup testing tools may show different results.We recommend that you use the <a href="https://search.google.com/test/rich-results" rel="nofollow" target="_blank">Rich Results Test</a> tool to review and validate your pages’ structured data against their rich snippet requirements.',
    },
    44: {
        title: "Malformed links",
        type: "error",
        description:
            "This issue is reported when SemrushBot fails to crawl a link because of an invalid link's URL.Common mistakes include the following:- Invalid URL syntax (e.g., no or an invalid protocol is specified, backslashes (\\) are used)- Spelling mistakes- Unnecessary additional characters",
        solution:
            "Make sure the link's URL conforms to a standard scheme and doesn't have any unnecessary characters or typos.",
    },
    46: {
        title: "Missing the viewport width value",
        type: "error",
        description:
            "This issue is triggered if the viewport meta tag used on your page is missing the width or initial scale value. <br/>The viewport meta tag is an HTML tag that allows you to control a page’s viewport size and scale on mobile devices. <br/>This tag is indispensable if you want to make your website accessible and optimized for mobile devices. <br/>For more information about the viewport meta tag, please see the Responsive web design basics article.",
        solution:
            'Specify the width and initial-scale values. We recommend you contact your developers for assistance. Once this is done,&nbsp;<a href="https://search.google.com/test/mobile-friendly" rel="nofollow" target="_blank">check your page</a>&nbsp;for mobile-friendliness or re-audit your site.',
    },
    102: {
        title: "Pages with too much text within the title tags",
        type: "warning",
        description:
            'Most search engines truncate titles containing more than 70 characters. Incomplete and shortened titles look unappealing to users and won\'t entice them to click on your page.<br>\nFor more information, please see <a href="https://support.google.com/webmasters/answer/35624" rel="nofollow" target="_blank">this Google article</a>.',
        solution: "Try to rewrite your page titles to be 70 characters or less.",
    },
    101: {
        title: "Pages without enough text within the title tags",
        type: "warning",
        description:
            'Generally, using short titles on webpages is a recommended practice. However, keep in mind that titles containing 10 characters or less do not provide enough information about what your webpage is about and limit your page\'s potential to show up in search results for different keywords.<br>\nFor more information, please see <a href="https://support.google.com/webmasters/answer/35624" rel="nofollow" target="_blank">this Google article</a>.',
        solution: "Add more descriptive text inside your page's &lt;title&gt; tag.",
    },
    112: {
        title: "Pages with low text-HTML ratio",
        type: "warning",
        description:
            "Your text-to-HTML ratio indicates the amount of actual text you have on your webpage compared to the amount of code. This issue is triggered when your text to HTML is 10% or less.<br>\nSearch engines have begun focusing on pages that contain more content. That's why a higher text-to-HTML ratio means your page has a better chance of getting a good position in search results.<br>\nLess code increases your page's load speed and also helps your rankings. It also helps search engine robots crawl your website faster.",
        solution:
            "Split your webpage's text content and code into separate files and compare their size. If the size of your code file exceeds the size of the text file, review your page's HTML code and consider optimizing its structure and removing embedded scripts and styles.",
    },
    106: {
        title: "Pages without meta descriptions",
        type: "warning",
        description:
            'Though meta descriptions don\'t have a direct influence on rankings, they are used by search engines to display your page\'s description in search results. A good description helps users know what your page is about and encourages them to click on it. If your page\'s meta description tag is missing, search engines will usually display its first sentence, which may be irrelevant and unappealing to users.<br>\nFor more information, please see these articles: <a href="https://support.google.com/webmasters/answer/35624" rel="nofollow" target="_blank">Create good titles and snippets in Search Results</a> and <a href="https://www.semrush.com/blog/on-page-seo-basics-meta-descriptions/" rel="nofollow" target="_blank">On-Page SEO Basics: Meta Descriptions</a>.',
        solution:
            "In order to gain a higher click-through rate, you should ensure that all of your webpages have meta descriptions that contain relevant keywords.",
    },
    105: {
        title: "Pages with duplicate H1 and title tags",
        type: "warning",
        description:
            'It is a bad idea to duplicate your title tag content in your first-level header. If your page\'s &lt;title&gt; and &lt;h1&gt; tags match, the latter may appear over-optimized to search engines.<br>\nAlso, using the same content in titles and headers means a lost opportunity to incorporate other relevant keywords for your page.<br>\nFor more information, please see <a href="https://support.google.com/webmasters/answer/35624" rel="nofollow" target="_blank">this Google article</a>.',
        solution: "Try to create different content for your &lt;title&gt; and &lt;h1&gt; tags.",
    },
    103: {
        title: "Pages without an h1 heading",
        type: "warning",
        description:
            "While less important than &lt;title&gt; tags, h1 headings still help define your page’s topic for search engines and users. If an &lt;h1&gt; tag is empty or missing, search engines may place your page lower than they would otherwise. Besides, a lack of an &lt;h1&gt; tag breaks your page’s heading hierarchy, which is not SEO-friendly.",
        solution: "Provide a concise, relevant h1 heading for each of your pages.",
    },
    122: {
        title: "Pages with an underscore in the URL",
        type: "warning",
        description:
            'When it comes to URL structure, using underscores as word separators is not recommended because search engines may not interpret them correctly and may consider them to be a part of a word. Using hyphens instead of underscores makes it easier for search engines to understand what your page is about.<br>\nAlthough using underscores doesn\'t have a huge impact on webpage visibility, it decreases your page\'s chances of appearing in search results, as opposed to when hyphens are used.<br>\nFor more information, please see <a href="https://support.google.com/webmasters/answer/76329?hl=en" rel="nofollow" target="_blank">this Google article</a>.',
        solution:
            "Replace underscores with hyphens. However, if your page ranks well, we do not recommend that you do this.",
    },
    124: {
        title: "Sitemap.xml not indicated in robots.txt",
        type: "warning",
        description:
            "If you have both a sitemap.xml and a robots.txt file on your website, it is a good practice to place a link to your sitemap.xml in your robots.txt, which will allow search engines to better understand what content they should crawl.",
        solution:
            'Specify the location of your sitemap.xml in your robots.txt. To check if Googlebot can index your sitemap.xml file, use the <a href="https://search.google.com/search-console/not-verified?original_url=/search-console/sitemaps&amp;original_resource_id" rel="nofollow" target="_blank">Sitemaps report in Google Search Console</a>.',
    },
    117: {
        title: "Pages with a low word count",
        type: "warning",
        description:
            'This issue is triggered if the number of words on your webpage is less than 200.<br>\nThe amount of text placed on your webpage is a quality signal to search engines.<br>\nSearch engines prefer to provide as much information to users as possible, so pages with longer content tend to be placed higher in search results, as opposed to those with lower word counts.<br>\nFor more information, please view <a href="https://www.youtube.com/watch?v=w3-obcXkyA4" rel="nofollow" target="_blank">this video</a>.',
        solution: "Improve your on-page content and be sure to include more than 200 meaningful words.",
    },
    109: {
        title: "Pages with temporary redirects",
        type: "warning",
        description:
            "Temporary redirects (i.e., a 302 and a 307 redirect) mean that a page has been temporarily moved to a new location. Search engines will continue to index the redirected page, and no link juice or traffic is passed to the new page, which is why temporary redirects can damage your search rankings if used by mistake.",
        solution:
            "Review all URLs to make sure the use of 302 and 307 redirects is justified. If so, don’t forget to remove them when they are no longer needed. However, if you permanently move any page, replace a 302/307 redirect with a 301/308 one.",
    },
    110: {
        title: "Images without alt attributes",
        type: "warning",
        description:
            'Alt attributes within &lt;img&gt; tags are used by search engines to understand the contents of your images. If you neglect alt attributes, you may miss the chance to get a better placement in search results because alt attributes allow you to rank in image search results.<br>\nNot using alt attributes also negatively affects the experience of visually impaired users and those who have disabled images in their browsers.<br>\nFor more information, please see these articles: <a href="https://webmasters.googleblog.com/2007/12/using-alt-attributes-smartly.html" rel="nofollow" target="_blank">Using ALT attributes smartly</a> and <a href="https://support.google.com/webmasters/answer/114016?hl=en" rel="nofollow" target="_blank">Google Image Publishing Guidelines</a>.',
        solution:
            'Specify a relevant alternative attribute inside an &lt;img&gt; tag for each image on your website, e.g., "&lt;img src="mylogo.png" alt="This is my company logo"&gt;".',
    },
    14: {
        title: "Broken external images",
        type: "warning",
        description:
            "A broken external image is an image that can't be displayed because it no longer exists or because its URL is misspelled. Having too many broken external images negatively affects user experience and may be a signal to search engines that your website is poorly coded or maintained.",
        solution:
            "To fix a broken external image, perform one of the following:<br>\n- If an image was deleted or damaged, replace it with a new one<br>\n- If an image is no longer needed, simply remove it from your page's code<br>\n- If an image moved to a different location and you know its new address, change its URL",
    },
    113: {
        title: "Pages with too many parameters in their URLs",
        type: "warning",
        description:
            "Using too many URL parameters is not an SEO-friendly approach. Multiple parameters make URLs less enticing for users to click and may cause search engines to fail to index some of your most important pages.",
        solution: "Try to use no more than four parameters in your URLs.",
    },
    114: {
        title: "Pages with no hreflang and lang attributes",
        type: "warning",
        description:
            "This issue is reported if your page has neither lang nor hreflang attribute.<br>\nWhen running a multilingual website, you should make sure that you’re doing it correctly.<br>\nFirst, you should use a hreflang attribute to indicate to Google which pages should be shown to visitors based on their location. That way, you can rest assured that your users will always land on the correct language version of your website.<br>\nYou should also declare a language for your webpage’s content (i.e., lang attribute). Otherwise, your web text might not be recognized by search engines. It also may not appear in search results&nbsp;or may be displayed incorrectly.",
        solution:
            'Perform the following:<br>\n- Add a lang attribute to the &lt;html&gt; tag, e.g., "&lt;html lang="en"&gt;"<br>\n- Add a hreflang attribute to your page\'s &lt;head&gt; tag, e.g., &lt;link rel="alternate" href="http://example.com/" hreflang="en"/&gt;',
    },
    115: {
        title: "Pages without character encoding declared",
        type: "warning",
        description:
            "Providing a character encoding tells web browsers which set of characters must be used to display a webpage’s content. If a character encoding is not specified, browsers may not render the page content properly, which may result in a negative user experience. Moreover, search engines may consider pages without a character encoding to be of little help to users and, therefore, place them lower in search results than those with a specified encoding.",
        solution:
            'Declare a character encoding either by specifying one in the charset parameter of the HTTP Content-Type header (Content-Type: text/html; charset=utf-8) or by using a meta charset attribute in your webpage HTML (&lt;meta charset="utf-8"/&gt;). For more details, please see these articles: <a href="https://www.w3.org/International/questions/qa-headers-charset" rel="nofollow" target="_blank">Character Encoding - HTTP header</a> and <a href="https://www.w3.org/International/tutorials/tutorial-char-enc" rel="nofollow" target="_blank">Character Encoding - HTML</a>',
    },
    116: {
        title: "Pages without doctype declared",
        type: "warning",
        description:
            "A webpage’s doctype instructs web browsers which version of HTML or XHTML is being used. Declaring a doctype is extremely important in order for a page’s content to load properly. If no doctype is specified, this may lead to various problems, such as messed up page content or slow page load speed, and, as a result, negatively affect user experience.",
        solution:
            'Specify a doctype for each of your pages by adding a &lt;!Doctype&gt; element (e.g., "&lt;!Doctype HTML5&gt;") to the very top of every webpage source, right before the &lt;html&gt; tag.',
    },
    120: {
        title: "Incompatible plugin content",
        type: "warning",
        description:
            "This issue is triggered if your page has content based on Flash, JavaApplet, or Silverlight plugins. These types of plugins do not work properly on mobile devices, which frustrates users. Moreover, they cannot be crawled and indexed properly, negatively impacting your website’s mobile rankings.",
        solution:
            'Convert unsupported plugin content into HTML5. If you’re using Flash videos on your website, please see <a href="https://developer.mozilla.org/en-US/docs/Plugins/Flash_to_HTML5/Video" rel="nofollow" target="_blank">this article</a>.',
    },
    121: {
        title: "Pages containing frames",
        type: "warning",
        description:
            "&lt;frame&gt; tags are considered to be one of the most significant search engine optimization issues. Not only is it difficult for search engines to index and crawl content within &lt;frame&gt; tags, which may in turn lead to your page being excluded from search results, using these tags also negatively affects user experience.",
        solution: "Try to avoid using &lt;frame&gt; tags whenever possible.",
    },
    12: {
        title: "Broken external links",
        type: "warning",
        description:
            "Broken external links lead users from one website to another and bring them to non-existent webpages. Multiple broken links negatively affect user experience and may worsen your search engine rankings because crawlers may think that your website is poorly maintained or coded.<br>\nPlease note that our crawler may detect a working link as broken. Generally, this happens if the server hosting the website you're referring to blocks our crawler from accessing this website.",
        solution:
            "Please follow all links reported as broken. If a target webpage returns an error, remove the link leading to the error page or replace it with another resource.<br>\nIf the links reported as broken do work when accessed with a browser, you should contact the website's owner and inform them about the issue.",
    },
    123: {
        title: "Internal links containing nofollow attribute",
        type: "warning",
        description:
            'The rel="nofollow" attribute is an element in an &lt;a&gt; tag that tells crawlers not to follow the link (e.g., "&lt;a href="http://example.com/link" rel="nofollow"&gt;Nofollow link example&lt;/a&gt;")."Nofollow" links don’t pass any link juice to referred webpages. That’s why it is not recommended that you use nofollow attributes in internal links. You should let link juice flow freely throughout your website. Moreover, unintentional use of nofollow attributes may result in your webpage being ignored by search engine crawlers even if it contains valuable content.',
        solution: "Make sure not to use nofollow attributes by mistake. Remove them from &lt;a&gt; tags, if necessary.",
    },
    108: {
        title: "Pages with too many on-page links",
        type: "warning",
        description:
            "This issue is triggered if a webpage contains more than 3,000 links. As a rule, search engines process as many on-page links as they consider necessary for a particular website. However, placing more than 3,000 links on a webpage can make your page look low-quality and even spammy to search engines, which may cause your page to drop in rankings or not show up in search results at all. Having too many on-page links is also bad for user experience.",
        solution:
            "Review all pages that contain more than 3,000 links and delete unnecessary links.<br>\nYou can also use the Internal Linking report to check your internal linking.",
    },
    125: {
        title: "Sitemap.xml not found",
        type: "warning",
        description:
            "A sitemap.xml file is used to list all URLs available for crawling. It can also include additional data about each URL.<br>\nUsing a sitemap.xml file is quite beneficial. Not only does it provide easier navigation and better visibility to search engines, it also quickly informs search engines about any new or updated content on your website. Therefore, your website will be crawled faster and more intelligently.",
        solution:
            'Consider generating a sitemap.xml file if you don\'t already have one.<br>\nThen you should specify the location of your sitemap.xml files in your robots.txt, and check if Googlebot can index your sitemap.xml file with the <a href="https://search.google.com/search-console/not-verified?original_url=/search-console/sitemaps&amp;original_resource_id" rel="nofollow" target="_blank">Sitemaps report in Google Search Console</a>',
    },
    127: {
        title: "Subdomains don't support SNI",
        type: "warning",
        description:
            "One of the common issues you may face when using HTTPS is when your web server doesn't support Server Name Indication (SNI). Using SNI allows you to support multiple servers and host multiple certificates at the same IP address, which may improve security and trust.",
        solution:
            "Make sure that your web server supports SNI. Keep in mind that SNI is not supported by some older browsers, which is why you need to ensure that your audience uses browsers supporting SNI.",
    },
    126: {
        title: "Homepage does not use HTTPS encryption",
        type: "warning",
        description:
            'Google considers a website\'s security as a ranking factor. Websites that do not support HTTPS connections may be less prominent in Google\'s search results, while HTTPS-protected sites will rank higher with its search algorithms.<br>\nFor more information, see <a href="https://webmasters.googleblog.com/2014/08/https-as-ranking-signal.html" rel="nofollow" target="_blank">this Google article</a>.',
        solution:
            'Switch your site to HTTPS. For more details, see <a href="https://support.google.com/webmasters/answer/6073543" rel="nofollow" target="_blank">Secure your site with HTTPS</a>.',
    },
    128: {
        title: "HTTP URLs in sitemap.xml for HTTPS site",
        type: "warning",
        description:
            "Your sitemap.xml should include the links that you want search engines to find and index. Using different URL versions in your sitemap could be misleading to search engines and may result in an incomplete crawling of your website.",
        solution: "Replace all HTTP URLs in your sitemap.xml with HTTPS URLs.",
    },
    31: {
        title: "Links on HTTPS pages leading to HTTP page",
        type: "warning",
        description:
            "If any link on the website points to the old HTTP version of the website, search engines can become confused as to which version of the page they should rank.",
        solution: "Replace all HTTP links with the new HTTPS versions.",
    },
    129: {
        title: "Uncompressed pages",
        type: "warning",
        description:
            "This issue is triggered if the Content-Encoding entity is not present in the response header. Page compression is essential to the process of optimizing your website. Using uncompressed pages leads to a slower page load time, resulting in a poor user experience and a lower search engine ranking.",
        solution: "Enable compression on your webpages for faster load time.",
    },
    130: {
        title: "Issues with blocked internal resources in robots.txt",
        type: "warning",
        description:
            'Blocked resources are resources (e.g., CSS, JavaScript, image files, etc.) that are blocked from crawling by a "Disallow" directive in your robots.txt file. By disallowing these files, you\'re preventing search engines from accessing them and, as a result, properly rendering and indexing your webpages. This, in return, may lead to lower rankings. For more information, please see <a href="https://developers.google.com/search/docs/crawling-indexing/robots/intro?sjid=4559026812217101995-EU#what-is-a-robots.txt-file-used-for" rel="nofollow" target="_blank">this article</a>.',
        solution: "To unblock a resource, simply update your robots.txt file.",
    },
    131: {
        title: "Issues with uncompressed JavaScript and CSS files",
        type: "warning",
        description:
            'This issue is triggered if compression is not enabled in the HTTP response.<br>\nCompressing JavaScript and CSS files significantly reduces their size as well as the overall size of your webpage, thus improving your page load time.<br>\nUncompressed JavaScript and CSS files make your page load slower, which negatively affects user experience and may worsen your search engine rankings.<br>\nIf your webpage uses uncompressed CSS and JS files that are hosted on an external site, you should make sure they do not affect your page\'s load time.<br>\nFor more information, please see <a href="https://developers.google.com/web/fundamentals/performance/optimizing-content-efficiency/" rel="nofollow" target="_blank">this Google article</a>.',
        solution:
            "Enable compression for your JavaScript and CSS files on your server.<br>\nIf your webpage uses uncompressed CSS and JS files that are hosted on an external site, contact the website owner and ask them to enable compression on their server.<br>\nIf this issue doesn't affect your page load time, simply ignore it.",
    },
    132: {
        title: "Issues with uncached JavaScript and CSS files",
        type: "warning",
        description:
            'This issue is triggered if browser caching is not specified in the response header.<br>\nEnabling browser caching for JavaScript and CSS files allows browsers to store and reuse these resources without having to download them again when requesting your page. That way the browser will download less data, which will decrease your page load time. And the less time it takes to load your page, the happier your visitors are.<br>\nFor more information, please see <a href="https://developers.google.com/web/fundamentals/performance/optimizing-content-efficiency/" rel="nofollow" target="_blank">this Google article</a>.',
        solution:
            "If JavaScript and CSS files are hosted on your website, enable browser caching for them.<br>\nIf JavaScript and CSS files are hosted on a website that you don't own, contact the website owner and ask them to enable browser caching for them.<br>\nIf this issue doesn't affect your page load time, simply ignore it.",
    },
    133: {
        title: "Pages have a JavaScript and CSS total size that is too large",
        type: "warning",
        description:
            'This issue is triggered if the total transfer size of the JavaScript and CSS files used on your page exceeds 2 MB.<br>\nThe size of the JavaScript and CSS files used on a webpage is one of the important factors for a page\'s load time. Having lots of clunky JavaScript and CSS files makes your webpage "heavier" in weight, thus increasing its load time. This in turn leads to a poor user experience and lower search engine rankings.<br>\nFor more information, please see <a href="https://developers.google.com/web/fundamentals/performance/optimizing-content-efficiency/" rel="nofollow" target="_blank">this Google article</a>.',
        solution:
            "Review your pages to make sure that they only contain necessary JavaScript and CSS files. If all resources are important for your page, consider reducing their transfer size.",
    },
    134: {
        title: "Pages use too many JavaScript and CSS files",
        type: "warning",
        description:
            'This issue is triggered if a webpage uses more than a hundred JavaScript and CSS files.<br>\nEach time a visitor navigates to a webpage, their browser first starts loading supportive files, such as JavaScript and CSS. For each file used by your webpage, a browser will send a separate HTTP request. Each request increases your page load time and affects its rendering, which has a direct impact on user experience, bounce rate, and, ultimately, search engine rankings.<br>\nFor more information, please see <a href="https://developers.google.com/web/fundamentals/performance/optimizing-content-efficiency/" rel="nofollow" target="_blank">this Google article</a>.',
        solution:
            "Review your pages to make sure that they only contain necessary JavaScript and CSS files.<br>\nIf all resources are important for your page, we recommend that you combine them.",
    },
    135: {
        title: "Issues with unminified JavaScript and CSS files",
        type: "warning",
        description:
            'Minification is the process of removing unnecessary lines, white space, and comments from the source code.<br>\nMinifying JavaScript and CSS files makes their size smaller, thereby decreasing your page load time, providing a better user experience, and improving your search engine rankings.<br>\nFor more information, please see <a href="https://developers.google.com/web/fundamentals/performance/optimizing-content-efficiency/" rel="nofollow" target="_blank">this Google article</a>.',
        solution:
            "Minify your JavaScript and CSS files.<br>\nIf your webpage uses CSS and JS files that are hosted on an external site, contact the website owner and ask them to minify their files.<br>\nIf this issue doesn't affect your page load time, simply ignore it.",
    },
    136: {
        title: "Too long link URLs",
        type: "warning",
        description:
            "This issue is triggered if your link URL is longer than 2,000 characters. Although theoretically there is no character limit for your URLs, it is still recommended that you keep their length under 2,000 characters. This is important because some browsers cannot handle URLs exceeding this limit. Moreover, keeping URLs at a reasonable length will make their crawling much easier, while extremely long URLs may be ignored by search engines.",
        solution:
            'Try to keep your link URLs shorter than 2,000 characters. For more information, please see <a href="https://support.google.com/webmasters/answer/76329?hl=en&amp;ref_topic=4617741" rel="nofollow" target="_blank">this article</a>.',
    },
    213: {
        type: "notice",
        title: "Pages with only one incoming internal linksource formatted as page link",
        description:
            "Having very few incoming internal links means very few visits, or even none, and fewer chances of placing in search results. It is a good practice to add more incoming internal links to pages with useful content. That way, you can rest assured that users and search engines will never miss them.",
        solution: "Add more incoming internal links to pages with important content.",
    },
    218: {
        type: "notice",
        title: "Links to external pages or resources returned a 403 HTTP status code",
        description:
            "This issue is triggered if a crawler gets a 403 code when trying to access an external webpage or resource via a link on your site. A 403 HTTP status code is returned if a user is not allowed to access the resource for some reason. In the case of crawlers, this usually means that a crawler is being blocked from accessing content at the server level.",
        solution:
            "Check that the page is available to browsers and search engines. To do this, follow a link in your browser and check the Google Search Console data.- If a page or resource is not available, contact the owner of the external website to restore deleted content or change the link on your page- If a page is available but our bot is blocked from accessing it, you can ask the external website owner to unblock the page, so we can check all resources correctly. You can also hide this issue from your list.",
    },
    217: {
        type: "notice",
        title: "Links with non-descriptive anchor text",
        description:
            'This issue is triggered if a non-descriptive anchor text is used for a link (either internal or external). An anchor is considered to be non-descriptive if it doesn’t give any idea of what the linked-to page is about, for example, “click here”, “right here”, etc. This type of anchor provides little value to users and search engines as it doesn\'t provide any information about the target page. Also, such anchors will offer little in terms of the target page’s ability to be indexed by search engines, and as a result, rank for relevant search requests. For more information on the criteria used to trigger this check, refer to <a href="https://www.semrush.com/kb/1060-unoptimized-anchors-site-audit" target="_blank">“What are unoptimized anchors and how does Site Audit identify them?”</a>.',
        solution:
            'To let users and search engines understand the meaning of the linked-to page, use a succinct anchor text that describes the page’s content. For best practices on how to optimize your anchor text, refer to the “Write good link text” section in <a href="https://support.google.com/webmasters/answer/7451184?hl=en&amp;ref_topic=9460495&amp;authuser=0" rel="nofollow" target="_blank">Google’s Search Engine Optimization (SEO) Starter Guide</a>.',
    },
    212: {
        type: "notice",
        title: "Pages that need more than 3 clicks to be reached",
        description:
            "A page's crawl depth is the number of clicks required for users and search engine crawlers to reach it via its corresponding homepage. From an SEO perspective, an excessive crawl depth may pose a great threat to your optimization efforts, as both crawlers and users are less likely to reach deep pages.<br>\nFor this reason, pages that contain important content should be no more than 3 clicks away from your homepage.",
        solution:
            "Make sure that pages with important content can be reached within a few clicks.<br>\nIf any of them are buried too deep in your site, consider changing your internal link architecture.",
    },
    202: {
        type: "notice",
        title: "Outgoing external links containing no follow attributes",
        description:
            'A nofollow attribute is an element in an &lt;a&gt; tag that tells crawlers not to follow the link. "Nofollow" links don’t pass any link juice or anchor texts to referred webpages. The unintentional use of nofollow attributes may have a negative impact on the crawling process and your rankings.',
        solution:
            "Make sure you haven’t used nofollow attributes by mistake. Remove them from &lt;a&gt; tags, if needed.&nbsp;",
    },
    205: {
        type: "notice",
        title: "Subdomains don't support HSTS",
        description:
            "HTTP Strict Transport Security (HSTS) informs web browsers that they can communicate with servers only through HTTPS connections. So, to ensure that you don't serve unsecured content to your audience, we recommend that you implement HSTS support.",
        solution: "Use a server that supports HSTS.",
    },
    201: {
        type: "notice",
        title: "URLs longer than 200 characters",
        description:
            "According to Google, long URLs are not SEO-friendly. Excessive URL length intimidates users and discourages them from clicking or sharing it, thus hurting your page's click-through rate and usability.",
        solution: "Keep your URLs at a reasonable length.",
    },
    104: {
        type: "notice",
        title: "Pages with more than one H1 tag",
        description:
            "Although multiple &lt;h1&gt; tags are allowed in HTML5, we still do not recommend that you use more than one &lt;h1&gt; tag per page. Including multiple &lt;h1&gt; tags may confuse users.",
        solution: "Use multiple &lt;h2&gt;-&lt;h6&gt; tags instead of an &lt;h1&gt;.",
    },
    203: {
        type: "notice",
        title: "Robots.txt not found",
        description:
            'A robots.txt file has an important impact on your overall SEO website\'s performance. This file helps search engines determine what content on your website they should crawl.<br>\nUtilizing a robots.txt file can cut the time search engine robots spend crawling and indexing your website.<br>\nFor more information, please see <a href="https://support.google.com/webmasters/answer/6062608" rel="nofollow" target="_blank">this Google article</a>.',
        solution:
            'If you don\'t want specific content on your website to be crawled, creating a robots.txt file is recommended. To check your robots.txt file, use Google\'s robots.txt Tester in <a href="https://www.google.com/webmasters/tools/robots-testing-tool" rel="nofollow" target="_blank">Google Search Console</a>.',
    },
    4: {
        type: "notice",
        title: "Pages that were blocked from crawling",
        description:
            "If a page cannot be accessed by search engines, it will never appear in search results. A page can be blocked from crawling either by a robots.txt file or a noindex meta tag.",
        solution: "Make sure that pages with valuable content are not blocked from crawling by mistake.",
    },
    206: {
        type: "notice",
        title: "Orphaned pages (from Google Analytics)",
        description:
            "A webpage that is not linked&nbsp;internally is called an orphaned page. It is very important to check your website for such pages. If a page has valuable content but is not linked to another page on your website, it can miss out on the opportunity to receive enough link juice. Orphaned pages that no longer serve their purpose confuse your users and, as a result, negatively affect their experience. We identify orphaned pages on your website by comparing the number of pages we crawled to the number of pages in your Google Analytics account. That's why to check your website for any orphaned pages, you need to connect your Google Analytics account.",
        solution:
            "Review all orphaned pages on your website and do either of the following:<br>\n- If a page is no longer needed, remove it<br>\n- If a page has valuable content and brings traffic to your website, link to it from another page on your website<br>\n- If a page serves a specific need and requires no internal linking, leave it as is.",
    },
    207: {
        type: "notice",
        title: "Orphaned pages (in sitemap)",
        description:
            "An orphaned page is a webpage that is not linked internally. Including orphaned pages in your sitemap.xml files is considered to be a bad practice, as these pages will be crawled by search engines. Crawling outdated orphaned pages will waste your crawl budget. If an orphaned page in your sitemap.xml file has valuable content, we recommend that you link to it internally.",
        solution:
            "Review all orphaned pages in your sitemap.xml files and do either of the following:<br>\n&nbsp;- If a page is no longer needed, remove it<br>\n&nbsp;- If a page has valuable content and brings traffic to your website, link to it from another page on your website<br>\n&nbsp;- If a page serves a specific need and requires no internal linking, leave it as is.",
    },
    209: {
        type: "notice",
        title: "Pages blocked by X-Robots-Tag: noindex HTTP header",
        description:
            "The x-robots-tag is an HTTP header that can be used to instruct search engines whether or not they can index or crawl a webpage. This tag supports the same directives as a regular meta robots tag and is typically used to control the crawling of non-HTML files. If a page is blocked from crawling with x-robots-tag, it will never appear in search results.",
        solution: "Make sure that pages with valuable content are not blocked from crawling by mistake.",
    },
    211: {
        type: "notice",
        title: "Issues with broken external JavaScript and CSS files",
        description:
            "If your website uses JavaScript or CSS files that are hosted on an external site, you should be sure that they work properly. Any script that has stopped running on your website may jeopardize your rankings&nbsp;since search engines will not be able to properly render and index your webpages. Moreover, broken JavaScript and CSS files may cause website errors, and this will certainly spoil your user experience.",
        solution: "Contact the website owner and ask them to fix a broken file.",
    },
    214: {
        type: "notice",
        title: "URLs with a permanent redirect",
        description:
            "Although using permanent redirects (a 301 or 308 redirect) is appropriate in many situations (for example, when you move a website to a new domain, redirect users from a deleted page to a new one, or handle duplicate content issues), we recommend that you keep them to a reasonable minimum. Every time you redirect one of your website's pages, it decreases your crawl budget, which may run out before search engines can crawl the page you want to be indexed. Moreover, too many permanent redirects can be confusing to users.",
        solution:
            "Review all URLs with a permanent redirect. Change permanent redirects to a target page URL where possible.",
    },
    216: {
        type: "notice",
        title: "Links with no anchor text",
        description:
            "This issue is triggered if a link (either external or internal) on your website has an empty or naked anchor (i.e., anchor that uses a raw URL), or anchor text only contains symbols. Although a missing anchor doesn't prevent users and crawlers from following a link, it makes it difficult to understand what the page you're linking to is about. Also, Google considers anchor text when indexing a page. So, a missing anchor represents a lost opportunity to optimize the performance of the linked-to page in search results.",
        solution:
            'Use anchor text for your links where it is necessary. The link text must give users and search engines at least a basic idea of what the target page is about. Also, use short but descriptive text. For more information, please see the "Use link wisely" section in <a href="https://support.google.com/webmasters/answer/7451184?hl=en&amp;ref_topic=9460495&amp;authuser=0" rel="nofollow" target="_blank">Google\'s SEO Starter Guide</a>.',
    },
    215: {
        type: "notice",
        title: "Resources formatted as page link",
        description:
            "We detected that some links to resources are formatted with &lt;a href&gt; HTML element. An &lt;a&gt; tag with a href attribute is used to link to other webpages and must only contain a page URL. Search engines will crawl your site from page to page by following these HTML page links. When following a page link that contains a resource, for example, an image, the returned page will not contain anything except an image. This may confuse search engines and will indicate that your site has poor architecture.",
        solution:
            "Review your links. Replace &lt;a href&gt; links with tags necessary for specific resources. For example, if you’d like to add an image, use an <img> tag with an alt attribute describing the contents of your image.",
    },
}

export const SEMRUSH_DATABASES = [
    { title: "United States", value: "us" },
    { title: "United Kingdom", value: "uk" },
    { title: "Canada", value: "ca" },
    { title: "Russia", value: "ru" },
    { title: "Germany", value: "de" },
    { title: "France", value: "fr" },
    { title: "Spain", value: "es" },
    { title: "Italy", value: "it" },
    { title: "Brazil", value: "br" },
    { title: "Australia", value: "au" },
    { title: "Argentina", value: "ar" },
    { title: "Belgium", value: "be" },
    { title: "Switzerland", value: "ch" },
    { title: "Denmark", value: "dk" },
    { title: "Finland", value: "fi" },
    { title: "Hong Kong", value: "hk" },
    { title: "Ireland", value: "ie" },
    { title: "Mexico", value: "mx" },
    { title: "Netherlands", value: "nl" },
    { title: "Norway", value: "no" },
    { title: "Poland", value: "pl" },
    { title: "Sweden", value: "se" },
    { title: "Singapore", value: "sg" },
    { title: "Turkey", value: "tr" },
    { title: "Japan", value: "jp" },
    { title: "India", value: "in" },
    { title: "Hungary", value: "hu" },
    { title: "Afghanistan", value: "af" },
    { title: "Albania", value: "al" },
    { title: "Algeria", value: "dz" },
    { title: "Angola", value: "ao" },
    { title: "Armenia", value: "am" },
    { title: "Austria", value: "at" },
    { title: "Azerbaijan", value: "az" },
    { title: "Bahrain", value: "bh" },
    { title: "Bangladesh", value: "bd" },
    { title: "Belarus", value: "by" },
    { title: "Belize", value: "bz" },
    { title: "Bolivia", value: "bo" },
    { title: "Bosnia and Herzegovina", value: "ba" },
    { title: "Botswana", value: "bw" },
    { title: "Brunei", value: "bn" },
    { title: "Bulgaria", value: "bg" },
    { title: "Cabo Verde", value: "cv" },
    { title: "Cambodia", value: "kh" },
    { title: "Cameroon", value: "cm" },
    { title: "Chile", value: "cl" },
    { title: "Colombia", value: "co" },
    { title: "Costa Rica", value: "cr" },
    { title: "Croatia", value: "hr" },
    { title: "Cyprus", value: "cy" },
    { title: "Czech Republic", value: "cz" },
    { title: "Congo", value: "cd" },
    { title: "Dominican Republic", value: "do" },
    { title: "Ecuador", value: "ec" },
    { title: "Egypt", value: "eg" },
    { title: "El Salvador", value: "sv" },
    { title: "Estonia", value: "ee" },
    { title: "Ethiopia", value: "et" },
    { title: "Georgia", value: "ge" },
    { title: "Ghana", value: "gh" },
    { title: "Greece", value: "gr" },
    { title: "Guatemala", value: "gt" },
    { title: "Guyana", value: "gy" },
    { title: "Haiti", value: "ht" },
    { title: "Honduras", value: "hn" },
    { title: "Iceland", value: "is" },
    { title: "Indonesia", value: "id" },
    { title: "Jamaica", value: "jm" },
    { title: "Jordan", value: "jo" },
    { title: "Kazakhstan", value: "kz" },
    { title: "Kuwait", value: "kw" },
    { title: "Latvia", value: "lv" },
    { title: "Lebanon", value: "lb" },
    { title: "Lithuania", value: "lt" },
    { title: "Luxembourg", value: "lu" },
    { title: "Madagascar", value: "mg" },
    { title: "Malaysia", value: "my" },
    { title: "Malta", value: "mt" },
    { title: "Mauritius", value: "mu" },
    { title: "Moldova", value: "md" },
    { title: "Mongolia", value: "mn" },
    { title: "Montenegro", value: "me" },
    { title: "Morocco", value: "ma" },
    { title: "Mozambique", value: "mz" },
    { title: "Namibia", value: "na" },
    { title: "Nepal", value: "np" },
    { title: "New Zealand", value: "nz" },
    { title: "Nicaragua", value: "ni" },
    { title: "Nigeria", value: "ng" },
    { title: "Oman", value: "om" },
    { title: "Panama", value: "pa" },
    { title: "Pakistan", value: "pk" },
    { title: "Taiwan", value: "tw" },
    { title: "Qatar", value: "qa" },
    { title: "Senegal", value: "sn" },
    { title: "Serbia", value: "rs" },
    { title: "Slovakia", value: "sk" },
    { title: "Slovenia", value: "si" },
    { title: "South Africa", value: "za" },
    { title: "South Korea", value: "kr" },
    { title: "Sri Lanka", value: "lk" },
    { title: "Thailand", value: "th" },
    { title: "Bahamas", value: "bs" },
    { title: "Trinidad and Tobago", value: "tt" },
    { title: "Tunisia", value: "tn" },
    { title: "Ukraine", value: "ua" },
    { title: "United Arab Emirates", value: "ae" },
    { title: "Uruguay", value: "uy" },
    { title: "Venezuela", value: "ve" },
    { title: "Vietnam", value: "vn" },
    { title: "Zambia", value: "zm" },
    { title: "Zimbabwe", value: "zw" },
    { title: "Libya", value: "ly" },
]
