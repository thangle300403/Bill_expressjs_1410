const inputs = document.querySelectorAll('.file-upload');
// const previewImage = document.getElementById('file-preview');
// const oldImage = document.getElementById('old-file');

// Assuming 'inputs' is a NodeList or HTMLCollection of input elements
inputs.forEach(input => {
    input.addEventListener('change', function (event) {
        const formEL = event.target.closest('form');
        const pIContainer = formEL.querySelector('.pIContainer');
        const oIContainer = formEL.querySelector('.oIContainer');
        const previewImage = formEL.querySelector('.file-preview');
        const file = event.target.files[0];

        if (file || previewImage.src != null) {
            const fileReader = new FileReader();
            fileReader.onload = function (event) {
                previewImage.src = event.target.result;
                pIContainer.style.display = 'block'; // Show the preview container
                oIContainer.style.display = 'none'; // Hide the old image
            };
            fileReader.readAsDataURL(file);
        } else {
            pIContainer.style.display = 'none'; // Hide the preview container if no file is selected
            oIContainer.style.display = 'block'; // Show the original image container
        }
    });
});

// Cập nhật giá trị của 1 param cụ thể
function getUpdatedParam(k, v) {
    //sort, price-asc
    const fullUrl = window.location.href;
    const objUrl = new URL(fullUrl);
    objUrl.searchParams.set(k, v);
    return objUrl.toString();
}

function goToPage(page) {
    // ngăn không cho chạy href mặc định của thẻ a
    const newURL = getUpdatedParam("page", page);
    window.location.href = newURL;
}

$("button.destroy").click(function (e) {
    e.preventDefault();
    var dataUrl = $(this).attr("data-href");
    // cập nhật giá trị cho thuộc tính href của thẻ a nằm trong modal (nút xác nhận)
    $("#exampleModal a").attr("href", dataUrl);
});

$(".form-login").validate({
    rules: {
        // simple rule, converted to {required:true}
        email: {
            required: true,
            email: true,
        },
        password: {
            required: true,
        },
    },
    messages: {
        email: {
            required: "Vui lòng nhập email",
            email: "Vui lòng nhập đúng định dạng email. vd: abc@gmail.com",
        },
        password: {
            required: "Vui lòng nhập mật khẩu",
        },
    },
});

$(".create-article").validate({
    rules: {
        title: {
            required: true,
        },
        short_description: {
            required: true,
        },
        description: {
            required: true,
        }
    },
    messages: {
        title: {
            required: "Vui lòng nhập tiêu đề bài viết",
        },
        short_description: {
            required: "Vui lòng nhập nội dung ngắn",
        },
        description: {
            required: "Vui lòng nhập nội dung",
        }
    },
});



// Example function to upload file and handle response
// $(document).ready(function () {
//     function getFileName() {
//         var formData = new FormData($('form')[0]); // Assuming your form is the first form on the page
//         $.ajax({
//             url: '?c=ckeditor&a=dashboard_index',
//             type: 'POST',
//             data: formData,
//             processData: false,
//             contentType: false,
//             success: function (response) {
//                 var data = JSON.parse(response);
//                 localStorage.setItem('uploadedFileName', data.filename); // Store the filename in local storage
//             }
//         });
//     }

//     $(window).on('beforeunload', function () {
//         var fileName = localStorage.getItem('uploadedFileName'); // Retrieve the filename from local storage
//         if (fileName) {
//             $.ajax({
//                 url: '?c=ckeditor&a=delete',
//                 type: 'POST',
//                 data: {
//                     fileName: fileName
//                 },
//                 async: false
//             });
//         }
//     });
// })
$('#updateModal').on('show.bs.modal', function (event) {
    var button = $(event.relatedTarget); // Button that triggered the modal
    var statusId = button.data('status-id'); // Extract order status ID

    // Clear any previously checked radio button
    $('#updateModal input[name="order_status"]').prop('checked', false);

    // Check the radio button that matches the statusId
    $('#updateModal input[name="order_status"][value="' + statusId + '"]').prop('checked', true);
});

function setOrderId(button) {
    const orderId = button.getAttribute('data-order-id'); // Get the order ID from the button's data attribute
    document.getElementById('order-id').value = orderId; // Set the hidden input's value
}

$('.check').on('change', function () {
    const roleId = $(this).data('role-id');
    const selectedPermissions = $('input[data-role-id="' + roleId + '"]:checked').map(function () {
        return $(this).val(); // Get all checked permissions for this specific role
    }).get();

    // AJAX request to update the backend
    $.ajax({
        url: '/admin/role/update-permissions',
        method: 'POST',
        data: {
            roleId: roleId,
            permissions: selectedPermissions // Send the selected permissions
        },
        success: function (response) {
            if (response.success) {
                $('#message-ajax').html('<div class="alert alert-success text-center">' + response.message + '</div>');
            } else {
                alert('Error updating role permissions');
            }
        },
        error: function (error) {
            console.log('Error updating role permissions:', error);
            alert('Failed to update role permissions. Please try again.');
        }
    });
});







