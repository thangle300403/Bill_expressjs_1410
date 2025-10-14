function openMenuMobile() {
    $(".menu-mb").width("250px");
    $(".btn-menu-mb").hide("slow");
}

function closeMenuMobile() {
    $(".menu-mb").width(0);
    $(".btn-menu-mb").show("slow");
}

// document ready, nghĩa là toàn bộ trang web được tải rồi
// code bên trong dấu {...} mới chạy
$(function () {
    // Thay đổi province
    $("main .province").change(function (event) {
        /* Act on the event */
        var province_id = $(this).val();
        if (!province_id) {
            updateSelectBox(null, "main .district");
            updateSelectBox(null, "main .ward");
            return;
        }

        $.ajax({
            url: '/address/districts',
            type: 'GET',
            data: { province_id: province_id }
        })
            .done(function (data) {
                updateSelectBox(data, "main .district");
                updateSelectBox(null, "main .ward");
            });

        if ($("main .shipping-fee").length) {
            $.ajax({
                url: '/address/shippingfee',
                type: 'GET',
                data: { province_id: province_id }
            })
                .done(function (data) {
                    //update shipping fee and total on UI
                    let shipping_fee = Number(data);
                    let payment_total = Number($("main .payment-total").attr("data")) + shipping_fee;

                    $("main .shipping-fee").html(number_format(shipping_fee) + "₫");
                    $("main .payment-total").html(number_format(payment_total) + "₫");
                });
        }


    });

    // Thay đổi district
    $("main .district").change(function (event) {
        /* Act on the event */
        var district_id = $(this).val();
        if (!district_id) {
            updateSelectBox(null, "main .ward");
            return;
        }

        $.ajax({
            url: '/address/wards',
            type: 'GET',
            data: { district_id: district_id }
        })
            .done(function (data) {
                updateSelectBox(data, "main .ward");
            });
    });

    //Hiện thị thông tin 
    displayCart();
    // / Thêm sản phẩm vào giỏ hàng
    $("main .buy").click(function (event) {

        var product_id = $(this).attr("product-id");
        $.ajax({
            url: '/cart/add',
            type: 'GET',
            data: { product_id: product_id, qty: 1 }
        })
            .done(function () {
                // console.log(data);
                displayCart();
            });
    });

    // Thêm sản phẩm vào giỏ hàng
    $(".input-group a.fancy").click(function (event) {
        /* Act on the event */
        var qty = $(this).closest(".input-group").find("input.product-quanity").val();
        var product_id = $(this).attr("product-id");
        $.ajax({
            url: '/cart/add',
            type: 'GET',
            data: { product_id: product_id, qty: qty }
        })
            .done(function () {
                displayCart();
            });
    });

    $.validator.addMethod(
        "regex",
        function (value, element, regexp) {
            var re = new RegExp(regexp);
            return this.optional(element) || re.test(value);
        },
        "Please check your input."
    );

    $(".form-contact").validate({
        rules: {
            fullname: {
                required: true,
                maxlength: 50,
                regex: /^[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳỵỷỹ\s]+$/i
            },
            mobile: {
                required: true,
                regex: /^0([0-9]{9})$/
            },
            email: {
                required: true,
                email: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/,
            },
            content: {
                required: true,
                maxlength: 500
            }
        },
        messages: {
            fullname: {
                required: "Full name is required.",
                maxlength: "Full name must not exceed 50 characters.",
                regex: "Full name must contain only letters and spaces."
            },
            mobile: {
                required: "Mobile number is required.",
                regex: "Mobile number must contain 10 digits and start with 0."
            },
            email: {
                required: "Email address is required.",
                email: "Please enter a valid email address, e.g., abc@gmail.com."
            },
            content: {
                required: "Content is required.",
                maxlength: "Content must not exceed 500 characters."
            }
        },
        submitHandler: function (form) {
            console.log('Form submitted');
            $('.message').html('<i class="fas fa-spinner fa-spin"></i> System is sending review, please wait...');
            $('.message').show();

            $.ajax({
                type: "POST",
                url: "/contact/sendEmail",
                data: $(form).serialize(),
                success: function (response) {
                    console.log('Response:', response);
                    $('.comment-list').html(response);
                    $('.message').html(response);
                    $('.message').removeClass('alert-danger');
                    $('.message').addClass('alert-success');
                    $('.message').show();
                    updateAnsweredRating();
                    form.reset();
                },
                error: function (xhr, status, error) {
                    console.log('Error:', xhr.responseText);
                    $('.message').html(xhr.responseText);
                    $('.message').removeClass('alert-success');
                    $('.message').addClass('alert-danger');
                }
            });
        }
    });

    $("form.form-comment").validate({
        rules: {
            // simple rule, converted to {required:true}
            fullname: {
                required: true,
                maxlength: 200,
                regex:
                    /^[a-zA￾ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳỵỷỹ\s]+$/i,
            },
            email: {
                required: true,
                email: true
            },

            description: {
                required: true,
            },
        },

        messages: {
            fullname: {
                required: "Vui lòng nhập họ và tên",
                maxlength: "Vui lòng nhập không quá 50 ký tự",
                regex: "Vui lòng nhập đúng định họ và tên",
            },
            email: {
                required: 'Vui lòng nhập email',
                email: 'Vui lòng nhập đúng định dạng email'
            },
            description: {
                required: 'Vui lòng nhập nội dung',
            },
        },

        submitHandler: function (form) {
            // alert('haha');
            // alert($(form).serialize());
            $('.message').html('<i class="fas fa-spinner fa-spin"></i> Hệ thống đang gởi đánh giá, vui lòng chờ ...');
            $('.message').show();

            $.ajax({
                type: "POST",
                url: "/comments",
                // Lấy dữ liệu trong form và gởi lên server
                data: $(form).serialize(),
                success: function (response) {
                    $('.comment-list').html(response);
                    $('.message').hide();
                    // Chuyển giá trị trong thẻ input thành số sao
                    updateAnsweredRating();
                    form.reset();
                },
                error: function (xhr, status, error) {

                    $('.message').html(xhr.responseText);
                    $('.message').removeClass('alert-success');
                    $('.message').addClass('alert-danger');
                    //reset form
                    // form.reset();
                }
            });
        }
    });

    $("form.form-register").validate({
        rules: {
            fullname: {
                required: true,
                maxlength: 200,
                regex: /^[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳỵỷỹ\s]+$/i
            },
            mobile: {
                required: true,
                minlength: 10,
                maxlength: 15,
                digits: true
            },
            email: {
                required: true,
                email: true,
                remote: "/customer/notexisting"
            },
            password: {
                required: true,
                minlength: 8,
                regex: /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/
            },
            password_confirmation: {
                required: true,
                minlength: 8,
                equalTo: "input[name='password']" // Ensures that this field matches the password field
            }
        },
        messages: {
            fullname: {
                required: "Vui lòng nhập họ và tên",
                maxlength: "Vui lòng nhập không quá 200 ký tự",
                regex: "Vui lòng nhập đúng định dạng họ và tên"
            },
            mobile: {
                required: "Vui lòng nhập số điện thoại",
                minlength: "Số điện thoại phải có ít nhất 10 số",
                maxlength: "Số điện thoại không được vượt quá 15 số",
                digits: "Vui lòng chỉ nhập số"
            },
            email: {
                required: "Vui lòng nhập email",
                email: "Vui lòng nhập đúng định dạng email"
            },
            password: {
                required: "Vui lòng nhập mật khẩu",
                minlength: "Mật khẩu phải có ít nhất 8 ký tự",
                regex: "Mật khẩu phải bao gồm ít nhất 1 chữ hoa, 1 chữ thường và 1 số"
            },
            password_confirmation: {
                required: "Vui lòng nhập lại mật khẩu",
                minlength: "Mật khẩu phải có ít nhất 8 ký tự",
                equalTo: "Mật khẩu nhập lại không khớp"
            }
        },
    });

    $("form.info-account").validate({
        rules: {
            fullname: {
                required: true,
                maxlength: 200,
                regex: /^[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳỵỷỹ\s]+$/i
            },
            mobile: {
                required: true,
                pattern: "[0][0-9]{9,}"
            },
            current_password: {
                required: true,
                required: function (element) {
                    return $("input[name='password']").val().length > 0;
                }
            },
            password: {
                required: true,
                required: function (element) {
                    return $("input[name='current_password']").val().length > 0;
                },
                minlength: 8,
                regex: /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/
            },
            password_confirmation: {
                required: true,
                required: function (element) {
                    return $("input[name='password']").val().length > 0;
                },
                minlength: 8,
                equalTo: "input[name='password']"
            }
        },
        messages: {
            fullname: {
                required: "Vui lòng nhập họ và tên",
                maxlength: "Vui lòng nhập không quá 200 ký tự",
                regex: "Vui lòng nhập đúng định dạng họ và tên"
            },
            mobile: {
                required: "Vui lòng nhập số điện thoại",
                pattern: "Vui lòng nhập số điện thoại bắt đầu bằng số 0 và ít nhất 9 con số theo sau"
            },
            current_password: {
                required: "Vui lòng nhập mật khẩu hiện tại nếu muốn đổi mật khẩu"
            },
            password: {
                required: "Vui lòng nhập mật khẩu mới nếu muốn đổi mật khẩu",
                minlength: "Mật khẩu phải có ít nhất 8 ký tự",
                regex: "Mật khẩu phải bao gồm ít nhất 1 chữ hoa, 1 chữ thường và 1 số"
            },
            password_confirmation: {
                required: "Vui lòng nhập lại mật khẩu mới",
                minlength: "Mật khẩu phải có ít nhất 8 ký tự",
                equalTo: "Mật khẩu nhập lại không khớp"
            }
        },
        submitHandler: function (form) {
            // Optional: Show a loading spinner or message
            $('.message').html('<i class="fas fa-spinner fa-spin"></i> Hệ thống đang xử lý, vui lòng chờ ...');
            $('.message').show();

            // Perform the form submission via AJAX
            $.ajax({
                type: "POST",
                url: "/thong-tin-tai-khoan.html",
                data: $(form).serialize(),
                success: function (response) {
                    $('.message').hide();
                    alert('Cập nhật thành công!');
                    form.reset();
                },
                error: function (xhr, status, error) {
                    $('.message').html(xhr.responseText);
                    $('.message').removeClass('alert-success');
                    $('.message').addClass('alert-danger');
                }
            });
        }
    });

    // Custom validator for regex
    $.validator.addMethod("regex", function (value, element, regexp) {
        return this.optional(element) || regexp.test(value);
    }, "Vui lòng nhập đúng định dạng.");


    $('#sort-select').change(function (event) {
        var fullURL = getUpdatedParam("sort", $(this).val());
        window.location.href = fullURL;
    });

    $('main .price-range input').click(function (event) {
        var price_range = $(this).val();
        window.location.href = `?price-range=${price_range}`;
    })

    $(".product-container").hover(function () {
        $(this).children(".button-product-action").toggle(400);
    });

    // Display or hidden button back to top
    $(window).scroll(function () {
        if ($(this).scrollTop()) {
            $(".back-to-top").fadeIn();
        }
        else {
            $(".back-to-top").fadeOut();
        }
    });

    // Khi click vào button back to top, sẽ cuộn lên đầu trang web trong vòng 0.8s
    $(".back-to-top").click(function () {
        $("html").animate({ scrollTop: 0 }, 800);
    });

    // Hiển thị form đăng ký
    $('.btn-register').click(function () {
        $('#modal-login').modal('hide');
        $('#modal-register').modal('show');
    });

    // Hiển thị form forgot password
    $('.btn-forgot-password').click(function () {
        $('#modal-login').modal('hide');
        $('#modal-forgot-password').modal('show');
    });

    // Hiển thị form đăng nhập
    $('.btn-login').click(function () {
        $('#modal-login').modal('show');
    });

    // Fix add padding-right 17px to body after close modal
    // Don't rememeber also attach with fix css
    $('.modal').on('hide.bs.modal', function (e) {
        e.stopPropagation();
        $("body").css("padding-right", 0);

    });

    // Hiển thị cart dialog
    $('.btn-cart-detail').click(function () {
        $('#modal-cart-detail').modal('show');
    });

    // Hiển thị aside menu mobile
    $('.btn-aside-mobile').click(function () {
        $("main aside .inner-aside").toggle();
    });

    // Hiển thị carousel for product thumnail
    $('main .product-detail .product-detail-carousel-slider .owl-carousel').owlCarousel({
        margin: 10,
        nav: true

    });
    // Bị lỗi hover ở bộ lọc (mobile) & tạo thanh cuộn ngang
    // Khởi tạo zoom khi di chuyển chuột lên hình ở trang chi tiết
    // $('main .product-detail .main-image-thumbnail').ezPlus({
    //     zoomType: 'inner',
    //     cursor: 'crosshair',
    //     responsive: true
    // });

    // Cập nhật hình chính khi click vào thumbnail hình ở slider
    $('main .product-detail .product-detail-carousel-slider img').click(function (event) {
        /* Act on the event */
        $('main .product-detail .main-image-thumbnail').attr("src", $(this).attr("src"));
        var image_path = $('main .product-detail .main-image-thumbnail').attr("src");
        $(".zoomWindow").css("background-image", "url('" + image_path + "')");

    });

    $('main .product-detail .product-description .rating-input').rating({
        min: 0,
        max: 5,
        step: 1,
        size: 'md',
        stars: "5",
        showClear: false,
        showCaption: false
    });

    $('main .product-detail .product-description .answered-rating-input').rating({
        min: 0,
        max: 5,
        step: 1,
        size: 'md',
        stars: "5",
        showClear: false,
        showCaption: false,
        displayOnly: false,
        hoverEnabled: true
    });

    $('main .ship-checkout[name=payment_method]').click(function (event) {
        /* Act on the event */
    });

    $('input[name=checkout]').click(async function (event) {
        /* Act on the event */
        const response = await fetch('/checkLogin');
        const data = await response.json(); // Chuyển đổi dữ liệu JSON
        const isLogin = data.isLogin;
        if (!isLogin) {
            $('#modal-login').modal('show');
            $('#modal-cart-detail').modal('hide');
        } else {
            window.location.href = "/dat-hang.html";
        }
    });

    $('input[name=back-shopping]').click(function (event) {
        /* Act on the event */
        window.location.href = "/san-pham.html";
    });

    // Hiển thị carousel for relative products
    $('main .product-detail .product-related .owl-carousel').owlCarousel({
        // loop: true,
        margin: 10,
        nav: true,
        dots: false,
        responsive: {
            0: {
                items: 2
            },
            600: {
                items: 4
            },
            1000: {
                items: 5
            }
        }

    });
});

// Login in google
function onSignIn(googleUser) {
    var id_token = googleUser.getAuthResponse().id_token;
    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'http://study.com/register/google/backend/process.php');
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.onload = function () {
        console.log('Signed in as: ' + xhr.responseText);
    };
    xhr.send('idtoken=' + id_token);
}

// Cập nhật giá trị của 1 param cụ thể
function getUpdatedParam(k, v) {//sort, price-asc
    const fullUrl = window.location.href;
    const objUrl = new URL(fullUrl);
    objUrl.searchParams.set(k, v);
    return objUrl.toString();
}

// Paging
function goToPage(page) {
    var fullUrl = getUpdatedParam("page", page);
    window.location.href = fullUrl;
    // window.location.href = 'https://vnexpress.net';
}

function updateAnsweredRating() {
    $('main .product-detail .product-description .answered-rating-input').rating({
        min: 0,
        max: 5,
        step: 1,
        size: 'md',
        stars: "5",
        showClear: false,
        showCaption: false,
        displayOnly: false,
        hoverEnabled: true
    });
}

// Hiển thị cart
function displayCart() {
    const data = getCookie('cart');
    if (!data) return;

    //chuyển chuỗi dạng Json thành object
    var cart = JSON.parse(data);

    var total_product_number = cart.total_product_number;
    $(".btn-cart-detail .number-total-product").html(total_product_number);

    var total_price = cart.total_price;
    $("#modal-cart-detail .price-total").html(number_format(total_price) + "₫");
    var items = cart.items;
    var rows = "";
    for (let i in items) {
        let item = items[i];
        var row = `
        <hr>
        <div class="clearfix text-left">
            <div class="row">
                <div class="col-sm-6 col-md-1">
                    <div>
                        <img class="img-responsive" src="/images/${item.img}" alt="${item.name}">
                    </div>
                </div>
                <div class="col-sm-6 col-md-3">
                    <a class="product-name" href="${item.url}"> ${item.name}</a>
                </div>
                <div class="col-sm-6 col-md-2">
                    <span class="product-item-discount">${number_format(Math.round(item.unit_price))}₫</span>
                </div>
                <div class="col-sm-6 col-md-3">
                    <input type="hidden" value="1">
                    <input type="number" onchange="updateProductInCart(this, ${item.product_id})" min="1" value="${item.qty}">
                </div>
                <div class="col-sm-6 col-md-2">
                    <span> ${number_format(Math.round(item.total_price))}₫</span>
                </div>
                <div class="col-sm-6 col-md-1">
                    <a class="remove-product" href="javascript:void(0)" onclick="deleteProductInCart(${item.product_id})">
                        <span class="glyphicon glyphicon-trash"></span>
                    </a>
                </div>
            </div>
        </div>`;
        rows += row;
    }
    $("#modal-cart-detail .cart-product").html(rows);
}

// Lấy giá trị của một cookie cụ thể
function getCookie(cname) {
    let name = cname + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function deleteProductInCart(product_id) {
    $.ajax({
        url: '/cart/delete',
        type: 'GET',
        data: { product_id: product_id }
    })
        .done(function () {
            displayCart();

        });
}

// Thay đổi số lượng sản phẩm trong giỏ hàng
function updateProductInCart(self, product_id) {
    var qty = $(self).val();
    $.ajax({
        url: '/cart/update',
        type: 'GET',
        data: { product_id: product_id, qty: qty }
    })
        .done(function () {
            displayCart();

        });
}
// Cập nhật các option cho thẻ select
function updateSelectBox(data, selector) {
    var items = JSON.parse(data);
    $(selector).find('option').not(':first').remove();
    if (!data) return;
    for (let i = 0; i < items.length; i++) {
        let item = items[i];
        let option = '<option value="' + item.id + '"> ' + item.name + '</option>';
        $(selector).append(option);
    }

}

$(document).ready(function () {
    $('button.destroy').click(function (e) {
        e.preventDefault();
        const data_href = $(this).attr('data-href');
        $('#confirm-delete').data('href', data_href);
        $('#exampleModal').modal('show');
    });

    $('#confirm-delete').click(function () {
        const data_href = $(this).data('href');
        window.location.href = data_href;
    });
});


