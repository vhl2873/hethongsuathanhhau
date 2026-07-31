// One-off/rerunnable seed script for real editorial blog content (nutrition
// guides, how-to-choose articles) - this is genuine written content, not
// fabricated customer data, so it doesn't fall under the "no fake data" rule.
// Safe to re-run: skips any post whose slug already exists.
// Run with: node server/scripts/seed-blog-posts.js
import 'dotenv/config';
import { supabaseAdmin } from '../src/lib/supabaseAdmin.js';
import { slugify } from '../src/lib/slugify.js';

const POSTS = [
  {
    title: 'Cách chọn sữa bột phù hợp theo từng độ tuổi của bé',
    excerpt: 'Mỗi giai đoạn phát triển của trẻ cần một công thức dinh dưỡng khác nhau. Bài viết giúp ba mẹ hiểu rõ các mốc tuổi quan trọng khi chọn sữa.',
    content: `<p>Việc chọn sữa bột cho bé không chỉ dựa vào thương hiệu quen thuộc mà cần căn cứ vào độ tuổi và nhu cầu dinh dưỡng cụ thể của từng giai đoạn phát triển.</p>
<h2>Giai đoạn 0-6 tháng tuổi</h2>
<p>Đây là giai đoạn sữa mẹ vẫn là nguồn dinh dưỡng tốt nhất. Nếu cần dùng thêm sữa công thức, nên ưu tiên các sản phẩm có công thức gần với sữa mẹ, bổ sung DHA, ARA hỗ trợ phát triển não bộ.</p>
<h2>Giai đoạn 6-12 tháng tuổi</h2>
<p>Bé bắt đầu ăn dặm nên cần sữa có bổ sung sắt, kẽm và các vi chất hỗ trợ hệ tiêu hóa đang hoàn thiện. Nên chọn sản phẩm có HMO hoặc chất xơ hòa tan để giảm nguy cơ táo bón.</p>
<h2>Giai đoạn 1-3 tuổi</h2>
<p>Trẻ vận động nhiều hơn, nhu cầu năng lượng và canxi tăng cao để hỗ trợ phát triển chiều cao. Đây cũng là giai đoạn phù hợp để cân nhắc các dòng sữa hỗ trợ tăng cân, tăng chiều cao nếu bé có dấu hiệu thấp còi.</p>
<h2>Trên 3 tuổi</h2>
<p>Có thể chuyển dần sang sữa tươi kết hợp chế độ ăn đa dạng, sữa bột lúc này đóng vai trò bổ sung dinh dưỡng chứ không còn là nguồn chính.</p>
<p>Dù chọn sản phẩm nào, ba mẹ nên tham khảo ý kiến bác sĩ nhi khoa nếu bé có tiền sử dị ứng đạm sữa bò hoặc các vấn đề tiêu hóa đặc biệt.</p>`,
    cover_image_url: './assets/img/nutifood-growplus-do-850g.jpg',
  },
  {
    title: 'Phân biệt sữa tươi tiệt trùng và thanh trùng - nên chọn loại nào?',
    excerpt: 'Hai phương pháp xử lý nhiệt khác nhau tạo ra hai loại sữa tươi có thời hạn sử dụng và hương vị khác nhau. Đâu là lựa chọn phù hợp cho gia đình bạn?',
    content: `<p>Trên kệ siêu thị, sữa tươi thường được chia thành hai loại: tiệt trùng (UHT) và thanh trùng (Pasteurized). Sự khác biệt nằm ở nhiệt độ và thời gian xử lý.</p>
<h2>Sữa tiệt trùng (UHT)</h2>
<p>Được xử lý ở nhiệt độ cao (khoảng 135-140°C) trong vài giây, giúp tiêu diệt hầu hết vi sinh vật. Nhờ vậy sữa có thể bảo quản ở nhiệt độ thường trong thời gian dài (thường 6 tháng đến 1 năm) khi chưa mở hộp, rất tiện lợi để tích trữ.</p>
<h2>Sữa thanh trùng</h2>
<p>Xử lý ở nhiệt độ thấp hơn (khoảng 72-75°C) trong thời gian ngắn, giữ được nhiều hương vị tự nhiên và một số vi chất nhạy cảm với nhiệt hơn so với UHT. Đổi lại, sữa thanh trùng cần bảo quản lạnh liên tục và có hạn sử dụng ngắn hơn nhiều (thường vài ngày đến 1-2 tuần).</p>
<h2>Vậy nên chọn loại nào?</h2>
<p>Nếu gia đình cần tích trữ dài ngày hoặc ít đi siêu thị, sữa UHT là lựa chọn thực tế. Nếu có tủ lạnh tốt và muốn trải nghiệm hương vị gần với sữa tươi nguyên bản hơn, có thể cân nhắc sữa thanh trùng và chú ý tiêu thụ trong hạn sử dụng ngắn.</p>`,
    cover_image_url: './assets/img/vinamilk-optimum-gold-1.jpg',
  },
  {
    title: 'Dinh dưỡng cho mẹ bầu: những dưỡng chất không thể thiếu',
    excerpt: 'Giai đoạn mang thai đòi hỏi chế độ dinh dưỡng đặc biệt. Tìm hiểu các nhóm dưỡng chất quan trọng mẹ bầu nên bổ sung mỗi ngày.',
    content: `<p>Chế độ dinh dưỡng trong thai kỳ ảnh hưởng trực tiếp đến sự phát triển của thai nhi và sức khỏe của mẹ. Dưới đây là các nhóm dưỡng chất quan trọng cần lưu ý.</p>
<h2>Axit folic</h2>
<p>Đặc biệt quan trọng trong tam cá nguyệt đầu tiên, giúp giảm nguy cơ dị tật ống thần kinh ở thai nhi. Có nhiều trong rau lá xanh đậm, các loại đậu và một số sản phẩm sữa bầu có bổ sung.</p>
<h2>Canxi và Vitamin D</h2>
<p>Nhu cầu canxi tăng cao để hỗ trợ hình thành hệ xương của thai nhi mà không làm suy giảm mật độ xương của mẹ. Vitamin D giúp cơ thể hấp thu canxi hiệu quả hơn.</p>
<h2>Sắt</h2>
<p>Thể tích máu tăng trong thai kỳ khiến nhu cầu sắt tăng đáng kể, giúp phòng ngừa thiếu máu do thiếu sắt - tình trạng khá phổ biến ở phụ nữ mang thai.</p>
<h2>DHA</h2>
<p>Hỗ trợ phát triển não bộ và thị giác của thai nhi, đặc biệt quan trọng trong tam cá nguyệt thứ ba.</p>
<p>Sữa bầu có thể là nguồn bổ sung tiện lợi cho các dưỡng chất trên, nhưng không thay thế hoàn toàn một chế độ ăn cân bằng. Mẹ bầu nên tham khảo bác sĩ sản khoa để có lộ trình dinh dưỡng phù hợp với thể trạng riêng.</p>`,
    cover_image_url: './assets/img/friso-gold-4-850g.jpg',
  },
  {
    title: 'Bảo quản sữa bột đúng cách để giữ trọn dinh dưỡng',
    excerpt: 'Sữa bột mở nắp rồi vẫn có thể mất chất hoặc nhiễm khuẩn nếu bảo quản sai cách. Một vài lưu ý đơn giản giúp hộp sữa luôn đảm bảo chất lượng.',
    content: `<p>Nhiều gia đình chỉ chú ý đến hạn sử dụng in trên hộp mà quên rằng cách bảo quản sau khi mở nắp cũng ảnh hưởng lớn đến chất lượng sữa.</p>
<h2>Đậy kín nắp sau mỗi lần dùng</h2>
<p>Sữa bột hút ẩm rất nhanh. Không khí ẩm lọt vào hộp không chỉ làm sữa vón cục mà còn tạo điều kiện cho vi khuẩn, nấm mốc phát triển.</p>
<h2>Bảo quản nơi khô ráo, thoáng mát</h2>
<p>Tránh để hộp sữa gần bếp, nơi có ánh nắng trực tiếp hoặc những chỗ ẩm thấp như gần nhà tắm. Nhiệt độ lý tưởng là nơi khô thoáng, tránh nhiệt độ cao dao động liên tục.</p>
<h2>Dùng trong 3-4 tuần sau khi mở nắp</h2>
<p>Dù hạn sử dụng trên hộp còn dài, hầu hết các hãng khuyến nghị dùng hết trong khoảng 3-4 tuần kể từ khi mở nắp để đảm bảo chất lượng tốt nhất.</p>
<h2>Dùng muỗng đong khô, sạch</h2>
<p>Không dùng muỗng ướt hoặc dùng chung muỗng với thực phẩm khác để múc sữa, tránh đưa hơi ẩm và vi khuẩn vào hộp.</p>`,
    cover_image_url: './assets/img/nutifood-growplus-colostrum-850g.jpg',
  },
  {
    title: 'HMO trong sữa công thức là gì và vì sao được nhắc đến nhiều?',
    excerpt: 'HMO là một trong những thành phần được nhiều hãng sữa quảng bá gần đây. Cùng tìm hiểu HMO thực chất là gì và vai trò của nó.',
    content: `<p>HMO (Human Milk Oligosaccharides) là nhóm dưỡng chất tự nhiên có nhiều thứ ba trong sữa mẹ, chỉ sau lactose và chất béo. Đây là lý do nhiều hãng sữa công thức nghiên cứu bổ sung HMO nhằm đưa công thức sữa đến gần hơn với sữa mẹ.</p>
<h2>Vai trò chính của HMO</h2>
<p>HMO đóng vai trò như một prebiotic, nuôi dưỡng lợi khuẩn đường ruột, từ đó hỗ trợ hệ tiêu hóa và hệ miễn dịch của trẻ. Một số nghiên cứu cũng ghi nhận HMO có thể giúp ngăn một số tác nhân gây bệnh bám vào niêm mạc ruột.</p>
<h2>HMO khác gì với chất xơ hòa tan (FOS/GOS)?</h2>
<p>FOS/GOS cũng là prebiotic phổ biến trong sữa công thức, nhưng có cấu trúc khác với HMO tự nhiên trong sữa mẹ. Nhiều sản phẩm hiện nay kết hợp cả HMO và FOS/GOS để tăng hiệu quả hỗ trợ tiêu hóa.</p>
<h2>Ba mẹ cần lưu ý gì?</h2>
<p>HMO là một thành phần đáng cân nhắc nhưng không phải yếu tố duy nhất quyết định chất lượng sữa. Nên xem xét tổng thể công thức dinh dưỡng, độ tuổi phù hợp và cơ địa của từng bé, đồng thời tham khảo tư vấn của bác sĩ nhi khoa khi cần.</p>`,
    cover_image_url: './assets/img/nutifood-growplus-colostrum-800g.jpg',
  },
];

let created = 0;
let skipped = 0;

for (const post of POSTS) {
  const slug = slugify(post.title);
  const { data: existing } = await supabaseAdmin.from('posts').select('id').eq('slug', slug).maybeSingle();
  if (existing) {
    console.log(`Bo qua (da ton tai): ${post.title}`);
    skipped += 1;
    continue;
  }

  const { error } = await supabaseAdmin.from('posts').insert({
    title: post.title,
    slug,
    excerpt: post.excerpt,
    content: post.content,
    cover_image_url: post.cover_image_url,
    is_published: true,
    published_at: new Date().toISOString(),
    meta_title: post.title,
    meta_description: post.excerpt,
  });

  if (error) {
    console.error(`Loi khi tao bai "${post.title}":`, error.message);
    continue;
  }
  created += 1;
  console.log(`Da tao: ${post.title}`);
}

console.log(`\nHoan tat: ${created} bai moi, ${skipped} bai da ton tai (bo qua).`);
