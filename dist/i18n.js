/* English / 中文. The normal URL always opens in English; ?lang=zh explicitly selects Chinese.
   Product data is translated before the app renders; page text is translated in place, including text the
   app or the 3D studio writes later. Strings without a translation stay in English. */
'use strict';
// Refuse to run inside another site's frame (clickjacking); GitHub Pages cannot send frame-ancestors headers.
if (window.top !== window.self) { try { window.top.location.replace(window.self.location.href); } catch { document.documentElement.style.display = 'none'; } }
(() => {
  const ZH = {
    // Page and header
    'Mao Han — Perfume Caps & Cosmetic Packaging': '茂涵 MAO HAN — 香水瓶盖与化妆品包装',
    'Explore Mao Han magnetic perfume caps, anodized aluminium closures, wooden caps, shoulder collars and pumps. Custom finishes and direct enquiries to Suzhou Maohan Metal Products Co., Ltd.': '浏览茂涵磁吸香水瓶盖、阳极氧化铝盖、实木盖、肩套与喷泵。可定制表面工艺，直接向 Suzhou Maohan Metal Products Co., Ltd. 询价。',
    'Skip to content': '跳到正文', 'Announcement': '公告',
    'Precision in every detail.': '每一处细节，皆见精准。',
    'Perfume & cosmetic packaging · Jiangsu, China': '香水与化妆品包装 · 中国江苏',
    'Discover the 2026 catalogue': '查看 2026 产品目录',
    'Mao Han home': '茂涵首页',
    'CAPS & CLOSURES': '瓶盖与封口件',
    'Main navigation': '主导航',
    'Our collection': '产品系列',
    '3D studio': '3D 工作室',
    'Materials & finishes': '材质与工艺',
    'About Mao Han': '关于茂涵',
    'View enquiry shortlist': '查看询价清单',
    'Let’s talk': '联系我们',
    'Open navigation': '打开导航',
    'Close navigation': '关闭导航',
    'Mobile navigation': '移动端导航',
    'Contact us': '联系我们',
    'Contact us ↗': '联系我们 ↗',
    // Hero
    'Loading 3D study…': '正在加载 3D 展示…',
    'MAO HAN / JIANGSU': '茂涵 / 江苏', 'JIANGSU': '江苏',
    'The finishing': '画龙点睛的',
    'touch.': '一笔。',
    'Magnetic perfume caps and cosmetic closures, shaped in aluminium, ABS and hardwood.': '磁吸香水瓶盖与化妆品封口件，以铝、ABS 与实木精制而成。',
    'Explore the collection': '浏览产品系列',
    'Open the 3D studio': '打开 3D 工作室',
    'FEATURED CLOSURE': '精选瓶盖',
    'DIAMETER × HEIGHT': '直径 × 高度',
    'WL100 assembly study. A gold cap turns, lines up over the bottle neck and lowers onto its collar. Two other cap forms rotate alongside it.': 'WL100 装配演示：金色瓶盖旋转、对准瓶口并落到肩套上，旁边另有两款瓶盖在旋转。',
    'MOTION STUDY': '动态演示',
    'Pause motion': '暂停动画',
    'Play motion': '播放动画',
    'Assembly stages': '装配步骤',
    'Turn': '旋转',
    'Align': '对准',
    'Seat': '扣合',
    'Replay the cap assembly': '重播瓶盖装配',
    'Replay': '重播',
    'Magnetic cap assemblies': '磁吸盖组件',
    'Aluminium, ABS & hardwood': '铝、ABS 与实木',
    'Colour, size & logo options': '颜色、尺寸与 Logo 可选',
    'Caps, collars & pumps': '瓶盖、肩套与喷泵',
    'Mao Han magnetic caps with matching perfume bottles': '茂涵磁吸盖与配套香水瓶',
    // Scroll story
    'THE ANATOMY OF A MAGNETIC CLOSURE': '磁吸瓶盖的结构',
    'Built to': '为那一声',
    'click.': '轻响而生。',
    'One quiet click.': '轻轻一声，稳稳扣合。',
    'The cap seats on its shoulder collar with a magnetic hold. No thread, no twist.': '瓶盖依靠磁力吸合在肩套上，无需螺纹，无需旋拧。',
    'Lift, and it lets go.': '轻轻一提，即可分离。',
    'A gentle pull releases the magnet and reveals the spray pump beneath.': '轻拉即可松开磁吸，露出下方的喷泵。',
    'Every layer, made to fit.': '每一层，都严丝合缝。',
    'Cap, shoulder collar and crimp pump, matched to FEA13 or FEA15 bottle necks.': '瓶盖、肩套与压口喷泵，适配 FEA13 或 FEA15 瓶口。',
    'Any finish you imagine.': '您想要的表面效果，我们都能实现。',
    'Glossy, matte, brushed, coated or hardwood.': '亮光、哑光、拉丝、喷涂或实木。',
    'Your mark, engraved.': '刻上您的标志。',
    'Laser-carved or screen-printed logos make the cap unmistakably yours.': '激光雕刻或丝印 Logo，让瓶盖独属于您的品牌。',
    'Magnetic cap': '磁吸盖',
    'Anodized aluminium · Ø27.5 × 28.6 mm': '阳极氧化铝 · Ø27.5 × 28.6 mm',
    'Crimp pump': '压口喷泵',
    'Shoulder collar': '肩套',
    'Ø24.6 mm · single step': 'Ø24.6 mm · 单层',
    'Your bottle': '您的瓶子',
    'Glass, in any shape': '玻璃瓶，任意造型',
    // Studio
    'THE INTERACTIVE STUDIO': '互动工作室',
    'Design it.': '随心设计，',
    'See it.': '所见即所得。',
    'Pick a shape, a finish and your logo.': '选择造型、表面工艺和您的 Logo。',
    '01 / SHAPE': '01 / 造型',
    'Cap family': '瓶盖系列',
    'Signature': '经典款',
    'Extended': '加高款',
    'Bead-rolled': '滚线款',
    'Diamond knurl': '钻石滚花',
    'Sphere': '球形',
    'Dome': '圆顶',
    'Soft square': '圆角方形',
    'Hardwood': '实木',
    '02 / FINISH': '02 / 表面工艺',
    'Cap finish': '瓶盖表面',
    'COLLAR': '肩套',
    'Matched': '同色',
    'Gold': '金色',
    'Silver': '银色',
    'Black': '黑色',
    '03 / YOUR LOGO': '03 / 您的 LOGO',
    'Your logo text': 'Logo 文字',
    'Type your brand name': '输入您的品牌名',
    'Logo decoration': 'Logo 工艺',
    'Laser engraved': '激光雕刻',
    'Gold foil': '烫金',
    'White print': '白色丝印',
    'Black print': '黑色丝印',
    'Enquire about this design': '咨询此设计',
    'WL100 glossy gold cap from the catalogue': '目录中的 WL100 亮金瓶盖',
    'Signature cylinder': '经典圆柱',
    'Extended cylinder': '加高圆柱',
    'Bead-rolled classic': '经典滚线',
    'Statement sphere': '个性球形',
    'Rounded dome': '圆润穹顶',
    'Hardwood cylinder': '实木圆柱',
    'Drag to turn': '拖动旋转',
    'Lift the cap': '提起瓶盖',
    'Close the cap': '盖上瓶盖',
    'Show on bottle': '装到瓶上',
    'Hide bottle': '隐藏瓶子',
    'Pause rotation': '暂停旋转',
    'Play rotation': '继续旋转',
    'Reset 3D view': '重置 3D 视图',
    'Reset': '重置',
    'Viewing angle': '观察角度',
    '3D viewing angle in degrees': '3D 观察角度（度）',
    // Collection
    '01 / THE COLLECTION': '01 / 产品系列',
    'Find your': '找到属于您的',
    'signature.': '标志之选。',
    'From the quiet confidence of a cylinder to the character of a sphere. Explore the form that feels like your brand.': '从圆柱的沉稳自信，到球形的鲜明个性，找到最契合您品牌的造型。',
    'Full technical catalogue': '完整技术目录',
    'Filter products by shape': '按造型筛选产品',
    'All pieces': '全部产品',
    'Cylindrical': '圆柱形',
    'Textured': '纹理款',
    'Sculptural': '造型款',
    'Glass bottles': '玻璃瓶',
    'Lids & closures': '盖子与封口件',
    'Accessories': '配件',
    'Search model, material or finish': '搜索型号、材质或表面工艺',
    'Find a model, material or finish…': '搜索型号、材质或表面工艺…',
    'Neck size': '瓶口尺寸',
    'All fittings': '全部瓶口',
    'No pieces found.': '没有找到产品。',
    'Try another model, material or neck size.': '换一个型号、材质或瓶口尺寸试试。',
    'Reset filters': '重置筛选',
    'Explore all pieces': '查看全部产品',
    'Looking for something specific?': '在找特定的款式？',
    'Price on request': '价格面议',
    'piece': '件',
    'pieces': '件',
    // Product dialog
    'Close product details': '关闭产品详情',
    'EXPLORE FINISHES': '查看表面工艺',
    'PRODUCT PHOTOS': '产品图片',
    'Add to enquiry': '加入询价',
    'Remove from enquiry': '从询价中移除',
    'Specification sheet ↗': '规格页 ↗',
    'Model': '型号',
    'Material': '材质',
    'Dimensions': '尺寸',
    'Neck fitting': '瓶口规格',
    'Catalogue weight': '目录标注重量',
    'Listing price': '标价',
    'Minimum order': '起订量',
    'Category': '类别',
    'Ask us for a quotation for your quantity, colours and logo.': '请告诉我们数量、颜色和 Logo 要求，我们为您报价。',
    'Confirm bottle-neck compatibility and your preferred collar combination when enquiring.': '询价时请确认瓶口匹配和您偏好的肩套搭配。',
    // Materials & finishes
    '02 / MATERIALS & FINISHES': '02 / 材质与工艺',
    'One form.': '同一造型，',
    'Endless expression.': '无限表达。',
    'The right finish changes everything. Explore real catalogue finishes, from polished metal to the warmth of hardwood.': '合适的表面工艺改变一切。浏览目录中的真实工艺，从抛光金属到温润实木。',
    'Discuss your finish': '咨询表面工艺',
    'ANODIZED ALUMINIUM': '阳极氧化铝',
    'HARDWOOD': '实木',
    'Glossy gold anodized aluminium cap': '亮金阳极氧化铝瓶盖',
    'COLOUR & TEXTURE STUDY': '颜色与质感',
    'Explore material finishes': '浏览材质工艺',
    'Polished gold': '抛光金',
    'Soft silver': '柔银',
    'Natural wood': '原木',
    // Made personal
    'A range of Mao Han perfume caps and matched perfume bottles in several colours': '茂涵多色香水瓶盖与配套香水瓶',
    'FROM OUR COLLECTION / WL100 & WL50': '来自我们的系列 / WL100 与 WL50',
    '02 / MADE PERSONAL': '02 / 专属定制',
    'Your vision.': '您的构想，',
    'Our details.': '我们的细节。',
    'Build a cohesive packaging language, from the cap in your customer’s hand to the collar beneath it.': '从顾客手中的瓶盖到其下的肩套，打造统一的包装语言。',
    'Choose your form': '选择造型',
    'Explore existing cap families and confirm your bottle’s neck fitting.': '浏览现有瓶盖系列，并确认您的瓶口规格。',
    'Define the finish': '确定表面工艺',
    'Discuss colour, surface treatments, screen printing and laser-engraved logos.': '沟通颜色、表面处理、丝印以及激光雕刻 Logo。',
    'Refine with a sample': '打样确认',
    'Send your selected models, dimensions and quantities to discuss sampling.': '发送您选择的型号、尺寸和数量，商讨打样。',
    'Start a custom enquiry': '开始定制询价',
    // About
    'THE PEOPLE BEHIND THE PIECE': '产品背后的团队',
    'Thoughtful packaging.': '用心的包装，',
    'A direct connection.': '直接的沟通。',
    'Mao Han (Suzhou Maohan Metal Products Co., Ltd.) makes magnetic perfume cap assemblies and cosmetic packaging components.': '茂涵（Suzhou Maohan Metal Products Co., Ltd.）专业生产磁吸香水瓶盖组件和化妆品包装配件。',
    'Explore anodized aluminium and ABS caps, hardwood forms, shoulder collars and perfume pumps, with options for customised colours, sizes and logos.': '产品包括阳极氧化铝和 ABS 瓶盖、实木瓶盖、肩套和香水喷泵，颜色、尺寸和 Logo 均可定制。',
    'Download the 2026 catalogue': '下载 2026 产品目录',
    'FACTORY': '工厂',
    'Jingjiang, Jiangsu, China': '中国江苏靖江',
    'OUR FOCUS': '专注领域',
    'Perfume & cosmetic packaging': '香水与化妆品包装',
    'OUR RANGE': '产品范围',
    'Caps · Collars · Pumps': '瓶盖 · 肩套 · 喷泵',
    'YOUR NEXT STEP': '下一步',
    'A conversation, then a sample.': '先沟通，再打样。',
    // Contact
    '03 / LET’S CREATE SOMETHING': '03 / 一起创造',
    'Every great bottle': '每一款好瓶子，',
    'starts with a': '都从一次',
    'conversation.': '沟通开始。',
    'Tell us what you have in mind. Share a model, a finish, or your next packaging idea.': '告诉我们您的想法：一个型号、一种工艺，或您的下一个包装创意。',
    'EMAIL': '邮箱',
    'WHATSAPP': 'WHATSAPP',
    'WECHAT · CLICK TO COPY': '微信 · 点击复制',
    'ADDRESS': '地址',
    'No. 1 Fumin Road, Chengbei Industrial Park,': '中国江苏省泰州市靖江市',
    'Jingjiang City, Taizhou, Jiangsu Province, China': '城北工业园区富民路 1 号',
    'Let’s find your finishing touch.': '一起找到那画龙点睛的一笔。',
    'Your name': '您的姓名',
    'Name': '姓名',
    'Company': '公司',
    'Brand or company': '品牌或公司',
    'Email': '邮箱',
    'Order quantity': '订购数量',
    'Country / region': '国家/地区', 'Select your country': '选择国家/地区', 'Phone / WhatsApp': '电话 / WhatsApp', 'Phone number': '电话号码',
    'e.g. 5,000': '例如 5,000',
    'YOUR SELECTED PIECES': '已选产品',
    'Clear shortlist': '清空清单',
    'Your project': '您的项目',
    'Models, finish, neck size, destination, or what you’d like to create…': '型号、工艺、瓶口尺寸、目的地，或您想做的产品…',
    'Send enquiry': '发送询价',
    'Sending…': '发送中…',
    'Sent to our sales team by email. Prefer chat?': '询价将通过邮件发送给销售团队。想直接聊？',
    'Send it on WhatsApp': '通过 WhatsApp 发送',
    'Email us directly': '直接发邮件',
    'Copy enquiry': '复制询价内容',
    'Chat with us on WhatsApp, +86 138 1295 0775': '通过 WhatsApp 联系我们，+86 138 1295 0775',
    // Footer, shortlist
    'A finishing touch,': '画龙点睛，',
    'thoughtfully made.': '用心之作。',
    '2026 catalogue ↗': '2026 产品目录 ↗',
    'Back to top': '回到顶部',
    'Suzhou Maohan Metal Products Co., Ltd. · No. 1 Fumin Road, Chengbei Industrial Park, Jingjiang City, Taizhou, Jiangsu Province, China': 'Suzhou Maohan Metal Products Co., Ltd. · 中国江苏省泰州市靖江市城北工业园区富民路 1 号',
    'Perfume caps. Considered details.': '香水瓶盖，细节考究。',
    'Ready for a closer look?': '想进一步了解？',
    'Enquire about your selection': '咨询已选产品',
    'Close shortlist': '关闭清单',
    'YOUR CURATED SELECTION': '您的精选',
    'A few good': '精挑',
    'details.': '细选。',
    'Save pieces as you browse, then send the selection with your enquiry.': '浏览时收藏产品，询价时一并发送。',
    'Your shortlist is waiting for its first piece.': '您的清单还是空的。',
    'Explore the collection ↗': '浏览产品系列 ↗',
    'Enquire about these pieces ↗': '咨询这些产品 ↗',
    'Please enable JavaScript to browse the interactive collection. You can also': '请启用 JavaScript 以浏览互动产品系列。您也可以',
    'view the full PDF catalogue': '查看完整 PDF 目录',
    // Messages
    'Piece removed from your enquiry.': '已从询价中移除。',
    'Your enquiry shortlist is clear.': '询价清单已清空。',
    'Your enquiry draft has been copied.': '询价内容已复制。',
    'Copy is unavailable. Please copy the displayed details.': '无法自动复制，请手动复制显示的内容。',
    'Please add your name, email and project details.': '请填写姓名、邮箱和项目详情。',
    'Enquiry sent.': '询价已发送。',
    'Thank you. Your enquiry has been sent to our sales team, and we will reply by email.': '谢谢！您的询价已发送给销售团队，我们会通过邮件回复。',
    'We could not send the form just now. Please email it directly or send it on WhatsApp.': '暂时无法发送表单，请直接发邮件或通过 WhatsApp 发送。',
    // Enquiry draft
    'Hello Mao Han, I would like to discuss a packaging enquiry.': '您好，茂涵，我想咨询包装产品。',
    'Selected pieces:': '已选产品：',
    'Project:': '项目：',
    'Language': '语言',
    // Categories
    'Cylindrical caps': '圆柱瓶盖',
    'Textured caps': '纹理瓶盖',
    'Sculptural caps': '造型瓶盖',
    'Hardwood caps': '实木瓶盖',
    'Glass bottles & sets': '玻璃瓶与套装',
    'Packaging accessories': '包装配件',
    // Badges
    'SIGNATURE': '经典',
    'SCULPTURAL': '造型',
    'NATURAL MATERIAL': '天然材质',
    'TEXTURED': '纹理',
    'SQUARE FORM': '方形',
    'BESTSELLER': '热销',
    'COMPLETE SET': '整套',
    'NEW': '新品', 'Standard': '标准款',
    // Finishes
    'Glossy gold': '亮金', 'Glossy silver': '亮银', 'Glossy black': '亮黑', 'Glossy red': '亮红', 'Glossy white': '亮白',
    'Glossy coffee': '亮咖啡色', 'Glossy dark grey': '亮深灰', 'Matte gold': '哑光金', 'Matte silver': '哑光银', 'Matte black': '哑光黑',
    'Matte blue': '哑光蓝', 'Matte red': '哑光红', 'Matte purple': '哑光紫', 'Matte white': '哑光白', 'Matte dark grey': '哑光深灰',
    'White coating': '白色喷涂', 'Blue coating': '蓝色喷涂', 'Coffee coating': '咖啡色喷涂', 'Brushed gold': '拉丝金',
    'Coffee wood': '咖啡色实木', 'White wood': '白色实木', 'Black wood': '黑色实木',
    'WL100 · Brushed gold': 'WL100 · 拉丝金', 'WL100 · Hydrographics': 'WL100 · 水转印', 'WL100 · Sandblasted silver': 'WL100 · 喷砂银',
    'WL50 · Brushed gold': 'WL50 · 拉丝金', 'WL50 · Sandblasted silver': 'WL50 · 喷砂银', 'JL30 · Brushed rose': 'JL30 · 拉丝玫瑰金',
    'JL30 · Hydrographics': 'JL30 · 水转印', 'JL30 · Sandblasted gold': 'JL30 · 喷砂金', 'KY100 · Brushed red': 'KY100 · 拉丝红',
    'KY100 · Sandblasted gold': 'KY100 · 喷砂金',
    'Assorted coloured tubes': '多色管', 'Assorted finishes': '多种表面工艺', 'Assorted metallic finishes': '多种金属工艺',
    'Black & gold presentation': '黑金款展示', 'Glossy black presentation': '亮黑款展示', 'Glossy gold presentation': '亮金款展示',
    'Glossy gold assortment': '亮金组合', 'Gold & coloured assortment': '金色与彩色组合', 'Gold pump presentation': '金色喷泵展示',
    // Product fields
    'Anodized aluminium': '阳极氧化铝', 'ABS': 'ABS', 'Aluminium cap assembly': '铝盖组件', 'Metal collar components': '金属肩套配件',
    'Anodized pump components': '阳极氧化喷泵配件', 'Cosmetic packaging components': '化妆品包装配件', 'Custom': '定制',
    'Custom / model dependent': '定制 / 视型号而定', 'Confirm selection': '待确认', 'Multiple assemblies': '多种组件',
    'Multiple profiles': '多种款式', 'On request': '按需提供', 'See technical drawing': '见技术图纸', 'Varies by model': '视型号而定',
    '30 g assembly': '组件 30 g', '36.8 g assembly': '组件 36.8 g',
    // Catalogue product names
    'The signature cylinder': '标志性圆柱', 'The extended cylinder': '加高圆柱', 'The ribbed classic': '经典滚线',
    'The statement sphere': '个性球形', 'The natural cylinder': '天然实木圆柱', 'The soft square': '圆角方形',
    'The refined cylinder': '精致圆柱', 'The diamond texture': '钻石纹理', 'The rounded silhouette': '圆润轮廓',
    'The compact cylinder': '小巧圆柱', 'The balanced cylinder': '匀称圆柱', 'The broad cylinder': '宽体圆柱',
    'The broad texture': '宽体纹理', 'The compact statement': '小巧个性款', 'The compact texture': '小巧纹理款',
    'The low cylinder': '矮款圆柱', 'The wide silhouette': '宽体轮廓', 'The tall round form': '高款圆形',
    'The architectural square': '建筑感方形', 'The metallic dome': '金属圆顶', 'The geometric accent': '几何造型',
    'The wooden sphere': '实木球形', 'The wooden dome': '实木圆顶', 'The wooden bowl': '实木碗形',
    'The rolled cylinder': '滚线圆柱', 'The rolled compact': '小巧滚线款', 'The textured signature': '纹理经典款',
    'The surface collection': '表面工艺系列', 'The connecting detail': '连接细节', 'The matched collar': '配套肩套',
    'The supporting form': '支撑结构', 'The finishing system': '喷泵系统', 'Beyond the perfume bottle': '不止香水瓶',
    'The colour companion': '多彩搭配', 'The clean profile': '简洁轮廓', 'The smooth classic': '光面经典款',
    'The tall detail': '高款细节',
    // Catalogue descriptions and notes
    'A 30 mm cylindrical magnetic cap assembly, available with matching metallic or matte shoulder collars.': '30 mm 圆柱磁吸盖组件，可配同色金属或哑光肩套。',
    'A 31 mm KY-series magnetic cap assembly in glossy or matte black.': '31 mm KY 系列磁吸盖组件，亮黑或哑光黑。',
    'A bead-rolled KY32 magnetic cap assembly, available in glossy and matte metallic finishes.': 'KY32 滚线磁吸盖组件，提供亮光和哑光金属工艺。',
    'A bead-rolled variation of the WL100 cap assembly, offered in glossy black and gold.': 'WL100 盖组件的滚线款，提供亮黑和金色。',
    'A broad cylindrical magnetic cap assembly in glossy black, gold and silver.': '宽体圆柱磁吸盖组件，亮黑、金色和银色。',
    'A broad, gently curved hardwood magnetic cap shown in black with a silver shoulder collar.': '宽体、弧度柔和的实木磁吸盖，图示为黑色木盖配银色肩套。',
    'A compact magnetic cap assembly for FEA13 fittings. Choose from metallic, matte, coated and coffee-coloured finishes.': '适配 FEA13 瓶口的小巧磁吸盖组件，可选金属、哑光、喷涂和咖啡色工艺。',
    'A cylindrical magnetic cap assembly from the JL30 series, with matching black, gold or silver collar finishes.': 'JL30 系列圆柱磁吸盖组件，可配黑色、金色或银色肩套。',
    'A cylindrical magnetic cap assembly with matched shoulder collar. Explore polished, matte and coated finishes.': '圆柱磁吸盖组件，配同色肩套，提供抛光、哑光和喷涂工艺。',
    'A domed electro-aluminium magnetic cap shown in glossy gold and silver.': '圆顶电化铝磁吸盖，图示为亮金和亮银。',
    'A hardwood magnetic cap with a cylindrical profile. The catalogue lists ash, beech and black walnut wood options.': '圆柱造型实木磁吸盖。目录列出白蜡木、榉木和黑胡桃木可选。',
    'A magnetic cap assembly with a bead-rolled surface. A textured alternative to the smooth cylindrical finish.': '滚线表面的磁吸盖组件，是光面圆柱款的纹理替代方案。',
    'A magnetic cap from the diamond-knurling section, offered in glossy black, gold and silver.': '钻石滚花系列磁吸盖，提供亮黑、金色和银色。',
    'A rectangular magnetic cap in glossy black with shoulder collar options in gold, black or silver.': '亮黑长方形磁吸盖，肩套可选金色、黑色或银色。',
    'A rounded hardwood magnetic cap in black, paired with a gold shoulder collar.': '黑色圆润实木磁吸盖，配金色肩套。',
    'A smooth-profile KY-series cap, paired with a matching black shoulder collar.': '光面 KY 系列瓶盖，配同色黑色肩套。',
    'A softly rounded magnetic cap assembly, offered in black, gold and white with glossy or matte finishes.': '圆润造型磁吸盖组件，提供黑、金、白三色，亮光或哑光。',
    'A spherical hardwood magnetic cap with visible natural character. The catalogue lists ash, beech and black walnut options.': '球形实木磁吸盖，保留天然木纹。目录列出白蜡木、榉木和黑胡桃木可选。',
    'A spherical magnetic cap with a rounded silhouette and coordinated shoulder collar. Available in metallic and coloured finishes.': '球形磁吸盖，轮廓圆润，配协调肩套，提供金属色和彩色工艺。',
    'A square magnetic cap with rounded edges, shown in black and gold in the catalogue’s new-product presentation.': '圆角方形磁吸盖，目录新品展示为黑金配色。',
    'A taller cylindrical cap from the JL52 family, with black, gold and silver finishes.': 'JL52 系列加高圆柱盖，提供黑色、金色和银色。',
    'A textured magnetic cap assembly for FEA13 bottle fittings, with matched metallic or coloured collars.': '适配 FEA13 瓶口的纹理磁吸盖组件，配同色金属或彩色肩套。',
    'A textured magnetic cap with coordinated shoulder collars, including a coated white and matte coffee combination.': '纹理磁吸盖，配协调肩套，包括白色喷涂与哑光咖啡色组合。',
    'A wider 35 mm magnetic cap assembly, with polished or matte black, gold and silver options.': '更宽的 35 mm 磁吸盖组件，提供抛光或哑光的黑、金、银色。',
    'An alternative WL-series magnetic cap profile with black, silver and red options.': 'WL 系列的另一款磁吸盖造型，提供黑色、银色和红色。',
    'An angular magnetic cap profile shown alongside the JL52 family, in glossy black, gold and coffee.': '棱角造型磁吸盖，与 JL52 系列一同展示，提供亮黑、金色和咖啡色。',
    'Anodized perfume pumps in black, gold and silver, with FEA13 and FEA15 fitting options.': '阳极氧化香水喷泵，黑、金、银三色，适配 FEA13 和 FEA15 瓶口。',
    'Brushed, sandblasted and hydrographic treatments for selected WL, KY and JL cap models. Choose a treatment and confirm the model specification.': '部分 WL、KY 和 JL 型号可做拉丝、喷砂和水转印处理。请选择工艺并确认型号规格。',
    'Choose the collar height and profile to suit the matching cap and bottle. See pages 38–39 for the full range.': '请根据配套瓶盖和瓶子选择肩套高度和款式，完整系列见目录第 38–39 页。',
    'Closures for healthcare, facial cream, essential oil and lotion packaging. The catalogue includes 45 × 12.5, 30 × 12.5 and 63.5 × 19.1 mm examples.': '适用于保健品、面霜、精油和乳液包装的封口件。目录示例包括 45 × 12.5、30 × 12.5 和 63.5 × 19.1 mm。',
    'Contact us to confirm the pump assembly, finish, dosage and bottle compatibility.': '请联系我们确认喷泵组件、工艺、喷量和瓶子匹配。',
    'Enquire to confirm individual finish options and the matching shoulder collar.': '请询价确认具体工艺和配套肩套。',
    'Enquire with your required dimensions, mechanism and decoration.': '请告知所需尺寸、结构和装饰要求。',
    'Fitting, dimensions and weight vary by selected model. The WL50 special-finish page lists FEA15; the standard WL50 page lists FEA13. Confirm the required fitting with the supplier.': '瓶口规格、尺寸和重量因型号而异。WL50 特殊工艺页标注 FEA15，标准 WL50 页标注 FEA13，请与供应商确认。',
    'JL30 shoulder collar profiles, plus multi-step and special-shaped collars for different cap assemblies.': 'JL30 肩套款式，以及适配不同瓶盖组件的多层和异形肩套。',
    'Lipstick tubes and lipstick bundles are available for customisation, alongside the catalogue’s cosmetic closure range.': '口红管和口红套装均可定制，另有目录中的化妆品封口件系列。',
    'Model name follows the JLM36 label printed on the product photograph.': '型号名称依据产品图片上标注的 JLM36。',
    'Single-step and double-step shoulder collars in metallic and coloured finishes, with FEA13 and FEA15 options shown in the catalogue.': '单层和双层肩套，提供金属色和彩色工艺，目录中有 FEA13 和 FEA15 可选。',
    'Specify the container and required closure dimensions in your enquiry.': '询价时请注明容器和所需封口尺寸。',
    'Square shoulder collars and middle collars, shown alongside circular collar options in the catalogue.': '方形肩套和中套，目录中同时展示圆形肩套款式。',
    'The bead-rolling version of the JL30 cap assembly, shown in glossy black and gold.': 'JL30 盖组件的滚线款，图示为亮黑和金色。',
    'The bead-rolling version of the JL30S magnetic cap assembly.': 'JL30S 磁吸盖组件的滚线款。',
    'The catalogue lists the family size as 35 × 41 mm. Confirm square-profile dimensions and collar fit when enquiring.': '目录标注该系列尺寸为 35 × 41 mm。询价时请确认方形尺寸和肩套匹配。',
    'The elongated member of the WL100 family, with additional height and a wide selection of metallic and coloured finishes.': 'WL100 系列的加高款，高度更高，提供丰富的金属色和彩色工艺。',
    'The image lists 33 g for the cap and 3.8 g for the collar (36.8 g total). Confirm dimensions against the technical drawing.': '图片标注瓶盖 33 g、肩套 3.8 g（共 36.8 g）。请对照技术图纸确认尺寸。',
    'The lower-profile JL30 assembly, retaining the 30 mm diameter in a shorter form.': 'JL30 矮款组件，保留 30 mm 直径，高度更低。',
    'The product photograph identifies this round variant as JLY52; the page heading groups it within the JL52 range.': '产品图片标注此圆形款为 JLY52，页面标题将其归入 JL52 系列。',
    'The specification image lists a 26.5 g cap and a 3.5 g shoulder collar (30 g total). Enquire for the silver finish.': '规格图标注瓶盖 26.5 g、肩套 3.5 g（共 30 g）。银色款请询价。',
    'The specification page also lists a shorter 32.5 × 29.6 mm, 29 g version. Confirm the required height when enquiring.': '规格页另列有较矮的 32.5 × 29.6 mm、29 g 版本，询价时请确认所需高度。',
    // Catalogue model names that contain words
    'Bead rolled': '滚线', 'Short': '矮款', 'Special finishes': '特殊工艺', 'Shoulder collars': '肩套', 'JL30 collars': 'JL30 肩套',
    'Square & middle collars': '方形肩套与中套', 'Perfume pumps': '香水喷泵', 'Cosmetic closures': '化妆品封口件', 'Lipstick packaging': '口红包装',
    // Storefront product names
    'Round luxury perfume bottle': '圆形高档香水瓶', 'Refillable round spray bottle': '可替换圆形喷雾瓶', 'Round fine-mist bottle': '圆形细雾瓶',
    'Flat circle perfume bottle': '扁圆香水瓶', 'Mini sample atomizers': '迷您试香瓶', 'Spherical glass bottle': '球形玻璃瓶',
    'Travel atomizer bottle': '旅行分装瓶', 'Clear travel spray bottle': '透明旅行喷雾瓶', 'Fancy square mini bottle': '精致方形小瓶',
    'Heavy square bottle, leather cap': '厚底方瓶，皮革纹盖', 'Acid-etched bottle, magnetic cap': '蚀刻瓶，磁吸盖', 'Frosted pocket sprayer': '磨砂便携喷雾瓶',
    'Portable glass perfume bottle': '便携玻璃香水瓶', 'Etched bottle with engraved cap': '蚀刻瓶配雕刻盖', 'Walnut-shaped spray bottle': '核桃造型喷雾瓶',
    'Blue gradient flat bottle': '蓝色渐变扁瓶', 'Press-type travel bottle': '按压式旅行瓶', 'Black frosted square bottle': '黑色磨砂方瓶',
    'Crystal white bottle': '晶白瓶', 'Petal hexagonal bottle': '花瓣六角瓶', 'Essential oil dropper bottles': '精油滴管瓶',
    'Bottle set with magnetic cap': '磁吸盖瓶套装', 'Magnetic glass bottle set': '磁吸玻璃瓶套装', 'Crown zinc-alloy cap': '皇冠锌合金盖',
    'Cylinder cap with logo': '带 Logo 圆柱盖', 'Black plastic caps': '黑色塑料盖', 'Leak-proof 15 mm cap': '15 mm 防漏盖',
    'Scribe-thread screw cap': '螺纹旋盖', 'Brushed aluminium lid': '拉丝铝盖', 'Brushed lid for cream jars': '面霜罐拉丝盖',
    'Aluminium cosmetic cover': '铝制化妆品盖', 'Magnetic cap and crimp collar': '磁吸盖与压口肩套', '13 mm crimp collar': '13 mm 压口肩套',
    'Bayonet nozzle collar': '卡口喷嘴肩套', 'Metal magnetic collar': '金属磁吸肩套', 'Aluminium shoulder collar': '铝制肩套',
    'Aluminium-plastic collar': '铝塑肩套', 'Leak-proof pump collar': '防漏喷泵肩套', 'Leak-proof magnetic cap set': '防漏磁吸盖套装',
    'Single-step magnetic cover': '单层磁吸盖', '27.5 × 28 straight magnetic cap': '27.5 × 28 直筒磁吸盖', '27.5 × 28 magnetic ring assembly': '27.5 × 28 磁环组件',
    '31 × 31 magnetic cap assembly': '31 × 31 磁吸盖组件', '25 × 25 magnetic cap assembly': '25 × 25 磁吸盖组件', 'Big-side sphere cap': '大边球形盖',
    'Spherical middle-sleeve cap': '球形中套盖', 'Big-side magnetic closure': '大边磁吸封盖', 'Raw hardwood magnetic cap': '原木磁吸盖',
    'Wooden spherical cap': '木质球形盖', 'Large-edge bright black cap': '大边亮黑盖', 'Large-edge magnetic cap': '大边磁吸盖',
    'Square black anodized cap': '黑色阳极氧化方盖', 'White aluminium magnetic ring': '白色铝磁环', 'Spherical cap with logo printing': '印 Logo 球形盖',
    // Storefront product lines
    '100 ml hexagonal glass, 15 mm pump': '100 ml 六角玻璃瓶，15 mm 喷泵',
    '100 ml thick-base square glass with leather-finish cap': '100 ml 厚底方形玻璃瓶，配皮革纹盖',
    '13 / 15 / 18 mm aluminium pump crimp, golden or silver': '13 / 15 / 18 mm 铝制压口喷泵，金色或银色',
    '18 ml square glass spray bottle, refillable': '18 ml 方形玻璃喷雾瓶，可重复灌装',
    '2 – 15 ml clear glass testers with pump sprayer': '2 – 15 ml 透明玻璃试香瓶，配喷泵',
    '2 – 5 ml plastic sample bottles with pump': '2 – 5 ml 塑料小样瓶，配喷泵',
    '20 / 30 / 60 ml round glass with fine-mist spray cap': '20 / 30 / 60 ml 圆形玻璃瓶，配细雾喷头',
    '30 / 50 / 100 ml flat round glass with pump sprayer': '30 / 50 / 100 ml 扁圆玻璃瓶，配喷泵',
    '30 / 50 / 100 ml glass with pump sprayer, custom colour and logo': '30 / 50 / 100 ml 玻璃瓶配喷泵，颜色和 Logo 可定制',
    '30 / 50 / 100 ml round glass with aluminium pump and magnetic cap': '30 / 50 / 100 ml 圆形玻璃瓶，配铝喷泵和磁吸盖',
    '30 / 50 / 75 ml sphere with 15 mm bayonet pump': '30 / 50 / 75 ml 球形瓶，配 15 mm 卡口喷泵',
    '30 / 50 ml clear glass, refillable and sealed': '30 / 50 ml 透明玻璃瓶，可灌装、密封',
    '30 / 50 ml glass with sealed pump sprayer': '30 / 50 ml 玻璃瓶，配密封喷泵',
    '30 / 50 ml large-capacity glass with pump': '30 / 50 ml 大容量玻璃瓶，配喷泵',
    '30 ml large-capacity glass with pump sprayer': '30 ml 大容量玻璃瓶，配喷泵',
    '5 – 100 ml glass with screw caps and droppers': '5 – 100 ml 玻璃瓶，配旋盖和滴管',
    '50 / 100 ml flat glass with acid-etched surface': '50 / 100 ml 扁形玻璃瓶，蚀刻表面',
    '50 ml bayonet bottle with pump': '50 ml 卡口瓶，配喷泵',
    '50 ml clear glass for perfume or essential oils': '50 ml 透明玻璃瓶，适用于香水或精油',
    '50 ml frosted glass atomizer with magnetic cap': '50 ml 磨砂玻璃喷雾瓶，配磁吸盖',
    'Acid-etched glass, magnetic cap assembly, engraved logo': '蚀刻玻璃，磁吸盖组件，雕刻 Logo',
    'Aluminium collar for fine-mist pumps, golden or silver': '细雾喷泵铝肩套，金色或银色',
    'Aluminium magnetic pump crimp, golden or silver': '铝制磁吸压口喷泵，金色或银色',
    'Aluminium screw lid in gold, black or silver': '铝制旋盖，金、黑或银色',
    'Aluminium-plastic fragrance cap, silver or gold': '铝塑香水盖，银色或金色',
    'Aluminium-plastic lid with magnetic ring': '铝塑盖，带磁环',
    'Aluminium-plastic magnetic cap, customisable logo': '铝塑磁吸盖，Logo 可定制',
    'Aluminium-plastic magnetic lid with anodized cap': '铝塑磁吸盖，氧化铝外盖',
    'Anodized cap with single-step shoulder and middle sleeve': '氧化铝盖，带单层肩套和中套',
    'Bayonet glass bottle with magnetic cap, custom colour': '卡口玻璃瓶配磁吸盖，颜色可定制',
    'Bottle cap ring for spray bottles': '喷雾瓶瓶盖环',
    'Bottle cover in custom colour and shape': '瓶盖，颜色和造型可定制',
    'Bottle, cap and mist-blocking spray head together': '瓶子、瓶盖与防溅喷头整套',
    'Brushed aluminium for FEA15 spray atomizers': 'FEA15 喷雾瓶用拉丝铝件',
    'Custom-made magnetic ring cap component': '定制磁环瓶盖配件',
    'Customisable solid wood perfume cap': '可定制实木香水盖',
    'Decorative crown design for 50 ml bottles': '50 ml 瓶用皇冠装饰盖',
    'Electro-aluminium cover with middle sleeve': '电化铝盖，带中套',
    'Electro-aluminium lid with middle sleeve': '电化铝盖，带中套',
    'Electro-aluminium magnetic cap with shoulder': '电化铝磁吸盖，带肩套',
    'Electro-aluminium magnetic sphere with middle sleeve': '电化铝磁吸球形盖，带中套',
    'Electro-aluminium magnetic sphere, big side': '电化铝磁吸球形盖，大边款',
    'Electro-aluminium sphere with glass, custom colour and logo': '电化铝球形盖配玻璃，颜色和 Logo 可定制',
    'Electro-aluminium sphere, 15 mm, custom logo': '电化铝球形盖，15 mm，Logo 可定制',
    'FEA13 / 15 / 18 customised collar for glass bottles': 'FEA13 / 15 / 18 玻璃瓶定制肩套',
    'FEA13 / 15 / 18 mm, gold or silver': 'FEA13 / 15 / 18 mm，金色或银色',
    'FEA13 / 15 cylinder collar, silver, gold or black, custom logo': 'FEA13 / 15 圆柱肩套，银、金或黑色，Logo 可定制',
    'FEA15 aluminium magnetic cap with collar': 'FEA15 铝制磁吸盖，带肩套',
    'Glass bottle, magnetic cap and mist-blocking spray head': '玻璃瓶、磁吸盖与防溅喷头',
    'Gold and black scribe metal lid for face cream': '面霜用金黑螺纹金属盖',
    'In stock for 15 / 13 mm necks, customisable': '现货适配 15 / 13 mm 瓶口，可定制',
    'Magnetic glass bottle set, custom colour, shape and size': '磁吸玻璃瓶套装，颜色、造型和尺寸可定制',
    'Perfume caps in various shapes and sizes': '多种造型和尺寸的香水瓶盖',
    'Plastic perfume cap with custom logo': '塑料香水盖，Logo 可定制',
    'Scribe metal lid in gold, black or silver': '螺纹金属盖，金、黑或银色',
    'Shoulder collar ring for cosmetic crimp sprayers': '化妆品压口喷头肩套环',
    'Spherical magnetic cap in natural wood': '天然木球形磁吸盖',
    'Square magnetic cap with anodized shoulder collar': '方形磁吸盖，配氧化铝肩套',
    'Straight round magnetic cap for pump sprayers': '喷泵用直筒圆形磁吸盖',
    // Client-supplied product photographs (Nov 2026), named as in the client's files.
    "Glossy black + glossy gold": "亮黑+亮金",
    "Black, gold & silver": "黑色、金色与银色",
    "Matte pink": "雾粉色",
    "Round · Gold & silver": "圆形 · 金色与银色",
    "Diamond knurling · Glossy black": "钻石滚花 · 亮黑",
    "JL30 · Brushed process, pink": "JL30 · 拉丝工艺 · 粉色",
    "WL100 · Brushed process": "WL100 · 拉丝工艺",
    "JL30 · Sandblasting process, gold": "JL30 · 喷砂工艺 · 金色",
    "WL100 & JL30 · Hydrographics": "WL100 & JL30 · 水转印",
    "WL100 · Coating process": "WL100 · 喷涂工艺",
    "Square · Gold, green, red & black": "方形 · 金、绿、红、黑",
    "Cylindrical wood · Black": "圆柱实木 · 黑色",
    "Cylindrical wood · Coffee": "圆柱实木 · 咖啡色",
    "Cylindrical wood · White": "圆柱实木 · 白色",
    "White": "白色",
    "Coffee": "咖啡色",
    "Cream cap": "面霜盖",
    "WL100 glossy black shoulder collar": "WL100 亮黑肩套",
    "KY100 double-step shoulder collar": "KY100 双层肩套",
    "WL100 shoulder collar": "WL100 肩套",
    "JL30 shoulder collar": "JL30 肩套",
    "Square shoulder collar": "方形肩套",
    "Glossy gold middle collar": "亮金中套",
    "Glossy silver middle collar": "亮银中套",
    "Middle collar": "中套",
    "Anodized pumps": "阳极氧化喷泵",
    "Plastic pumps": "塑料喷泵",
    "Lipstick tube": "口红管",
    "Anodized and plastic perfume pumps in gold, silver and black, with FEA13 and FEA15 fitting options.": "阳极氧化与塑料香水喷泵，提供金色、银色和黑色，适配 FEA13 与 FEA15 瓶口。",
    "Brushed, sandblasted, hydrographic and coated treatments for selected WL, KY and JL cap models. Choose a treatment and confirm the model specification.": "适用于部分 WL、KY 和 JL 瓶盖型号的拉丝、喷砂、水转印与喷涂工艺。请选择工艺并确认型号规格。",
  };

  // Text built from numbers or other strings.
  const PATTERNS = [
    [/^(\d[\d,]*) pieces?$/, '$1 件'],
    [/^Showing (\d+) of (\d+) pieces$/, '显示 $1 / $2 件'],
    [/^(\d+) pieces? selected$/, '已选 $1 件'],
    [/^View enquiry shortlist, (\d+) pieces?$/, '查看询价清单，$1 件'],
    [/^MOQ ([\d,]+)$/, '起订量 $1'],
    [/^Photo (\d+)$/, '图片 $1'],
    [/^WeChat ID copied: ([\w-]+)$/, '微信号已复制：$1'],
    [/^View (\S+) specifications$/, '查看 $1 规格'],
    [/^(.+) per piece$/, '$1 / 件'],
    [/^Quantity: (.+) pieces$/, '数量：$1 件'],
    [/^Name: (.*)$/, '姓名：$1'], [/^Phone: (.*)$/, '电话：$1'], [/^Country: (.*)$/, '国家/地区：$1'], [/^Email: (.*)$/, '邮箱：$1'], [/^Company: (.*)$/, '公司：$1'],
    [/^Packaging enquiry from (.+)$/, s => `包装询价 — ${s.replace(/^Packaging enquiry from /, '')}`],
  ];
  const DYNAMIC = [
    [/^(.+) added to your enquiry\.$/, (m, a) => `${a} 已加入询价单。`],
    [/^Explore (.+) — (.+)$/, (m, a, b) => `查看 ${a} — ${tr(b)}`],
    [/^Add (.+) to enquiry$/, (m, a) => `将 ${tr(a)} 加入询价`],
    [/^Remove (.+) from enquiry$/, (m, a) => `从询价中移除 ${tr(a)}`],
    [/^Remove (.+)$/, (m, a) => `移除 ${tr(a)}`],
    [/^3D preview: (\S+) (.+?) in (.+?)(?:, with “(.*)” (.+?))?\.$/, (m, model, name, finish, logo, style) =>
      `3D 预览：${model} ${tr(name)}，${tr(finish)}${logo ? `，Logo “${logo}” ${tr(style)}` : ''}。`],
  ];

  const params = new URLSearchParams(location.search);
  const lang = (params.get('lang') === 'zh' || document.documentElement.dataset?.lang === 'zh') ? 'zh' : 'en';

  const lower = new Map(Object.entries(ZH).map(([k, v]) => [k.toLowerCase(), v]));
  const SEP = / · | \/ | — |, /;
  // Model codes, sizes and numbers stay as they are.
  const neutral = s => !/[a-z]{2}/.test(s) || /^[A-Z0-9][A-Z0-9 ./×–\-+]*$/.test(s) || /^[\w.+-]+@[\w.-]+$/.test(s);
  function tr(text) {
    if (lang !== 'zh' || text == null) return text;
    const s = String(text).replace(/\s+/g, ' ').trim();   // runs of spaces and &nbsp; count as one space
    if (!s) return text;
    if (ZH[s] !== undefined) return ZH[s];
    const lc = lower.get(s.toLowerCase());
    if (lc !== undefined) return lc;
    for (const [re, out] of PATTERNS) if (re.test(s)) return typeof out === 'function' ? out(s) : s.replace(re, out);
    for (const [re, fn] of DYNAMIC) { const m = s.match(re); if (m) return fn(...m); }
    // "WL100 / Glossy gold", "WL100, Glossy gold", "Glossy gold · FEA15": translate each part.
    const sep = s.match(SEP);
    if (sep) {
      const parts = s.split(sep[0]);
      const out = parts.map(p => neutral(p.trim()) ? p : tr(p));
      if (out.every((p, i) => p !== parts[i] || neutral(parts[i].trim()))) return out.join(sep[0]);
    }
    return text;
  }

  // Product data: translated before the app reads it; English is kept for search and colour lookups.
  const J = window.JIALAN;
  if (J && lang === 'zh') {
    for (const k of Object.keys(J.categories || {})) J.categories[k] = tr(J.categories[k]);
    for (const p of J.products || []) {
      p._en = { name: p.name, model: p.model, description: p.description, material: p.material, finishes: [...(p.finishes || [])] };
      if (p.name_zh) p.name = p.name_zh; else p.name = tr(p.name);
      if (p.description_zh) p.description = p.description_zh; else if (p.description) p.description = tr(p.description);
      p.model = p.model_zh || tr(p.model);
      for (const k of ['material', 'size', 'weight', 'note', 'badge']) if (p[k]) p[k] = tr(p[k]);
      if (p.badge_zh) p.badge = p.badge_zh;
      if (p.finishes) p.finishes = p.finishes.map(tr);
    }
  }

  // Page text: translate text nodes and the attributes people read.
  const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT']);
  function translateText(node) {
    if (node.parentNode && node.parentNode.nodeName === 'TEXTAREA') return;  // what a visitor typed
    const raw = node.nodeValue;
    if (!raw || !/[A-Za-z]/.test(raw)) return;
    const out = tr(raw);
    if (out !== raw && typeof out === 'string') {
      const lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0];
      node.nodeValue = lead + out + trail;
    }
  }
  function translateEl(el) {
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v && /[A-Za-z]/.test(v)) { const out = tr(v); if (out !== v) el.setAttribute(a, out); }
    }
  }
  function walk(root) {
    if (root.nodeType === 3) { if (!SKIP.has(root.parentNode?.nodeName)) translateText(root); return; }
    if (root.nodeType !== 1 || SKIP.has(root.nodeName) || root.closest?.('[data-no-translate]')) return;
    translateEl(root);
    const it = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.nodeType === 1 && (SKIP.has(n.nodeName) || n.hasAttribute('data-no-translate')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    let n;
    while ((n = it.nextNode())) n.nodeType === 3 ? translateText(n) : translateEl(n);
  }

  // Switch: "中文" while in English, "EN" while in Chinese. The page reloads in the chosen language.
  function addSwitch() {
    const make = cls => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'lang-switch ' + cls; b.setAttribute('data-no-translate', '');
      b.textContent = lang === 'zh' ? 'EN' : '中文';
      b.setAttribute('aria-label', lang === 'zh' ? 'Switch to English' : '切换到中文');
      b.lang = lang === 'zh' ? 'en' : 'zh';
      b.addEventListener('click', () => {
        // English is the site root; Chinese is the pre-translated /zh page beside it.
        const u = new URL(lang === 'zh' ? './' : 'zh', location.href);
        u.hash = location.hash;
        location.href = u.toString();
      });
      return b;
    };
    document.querySelector('.header-actions')?.prepend(make('in-header'));
    document.getElementById('mobile-nav')?.append(make('in-menu'));
  }

  window.I18N = { lang, t: tr };
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.documentElement.classList.toggle('lang-zh', lang === 'zh');
  addSwitch();
  if (lang === 'zh') {
    document.title = tr(document.title);
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.content = tr(desc.content);
    walk(document.body);
    document.documentElement.classList.remove('i18n-pending');
    new MutationObserver(records => {
      for (const r of records) {
        if (r.type === 'characterData') translateText(r.target);
        else if (r.type === 'attributes') translateEl(r.target);
        else r.addedNodes.forEach(walk);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
})();
