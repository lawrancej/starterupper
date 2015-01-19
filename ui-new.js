// The M in MVC
var model = {
    // Server-set constant getters
    // Name of the repository
    repo: function()       { return $("#repository").val(); },
    // Who's the instructor? (i.e., github login)
    instructor: function() { return $("#instructor").val(); },
    // User's login at their machine
    hostLogin: function()  { return $("#host").val(); },
    // User's public key
    publicKey: function()  { return $("#public-key").val(); },
    
    // Server-initialized variable getters
    // The user's full name
    name: function() {
        // Is the name valid?
        var isValid = function(value) {
            var regex = /[^ ]+( [^ ]+)+/;
            return regex.test(value);
        };
        // Get name from the form element
        if (isValid($("#name").val().trim())) {
            localStorage.setItem("User.name", $("#name").val().trim());
            return $("#name").val().trim();
        }
        // Get name from localStorage (user confirmed value)
        if (localStorage.hasOwnProperty("User.name") && isValid(localStorage.getItem("User.name"))) {
            return localStorage.getItem("User.name");
        }
        // FAIL
        return "";
    },
    // The user's school email address
    email: function() {
        // Is the user's email valid?
        var isValid = function(value) {
            var regex1 = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
            var regex2 = /edu$/;
            return regex1.test(value) && regex2.test(value);
        };
        var theEmail = $("#email").val().toLowerCase().trim();
        // Get email from the form element
        if (isValid(theEmail)) {
            localStorage.setItem("User.email", theEmail);
            return theEmail;
        }
        // Get email from localStorage (user confirmed value)
        if (localStorage.hasOwnProperty("User.email") && isValid(localStorage.getItem("User.email"))) {
            return localStorage.getItem("User.email");
        }
        // FAIL
        return "";
    },
    // Gravatar ID
    gravatarId: function() { return SparkMD5.hash(model.email()); },
};

// The C in MVC :-)
var controller = {
    // Show class and hide its opposite
    update: function(klass, value) {
        $(((value) ? "." : ".no-")+klass).show();
        $(((value) ? ".no-" : ".")+klass).hide();
    },
    // Update name view on change
    name: function() {
        $( "#git-config-name" ).html('git config --global user.name "' + model.name() + '"');
    },
    // Update email view on change
    email: function() {
        $( "#git-config-email" ).html('git config --global user.email ' + model.email());
        
        $("#visible-gravatar").attr('src', 'http://www.gravatar.com/avatar/' + model.gravatarId() + '?d=retro&s=140');
        $.ajax({
            method: "GET",
            dataType: "jsonp",
            crossDomain: true,
            processData: false,
            url: 'https://en.gravatar.com/' + model.gravatarId() + '.json',
            success: function(response) {
                localStorage.setItem("Gravatar", model.gravatarId());
                controller.update('gravatar-account',true);
            },
            error: function(response) {
                localStorage.removeItem("Gravatar");
                controller.update('gravatar-account',false);
            }
        });
    },
    gravatar: function() {
        controller.update('gravatar-authenticated',false);
    },
    github: function() {
        if (Github.authenticated()) {
            $("#github-login").val(Github.getUsername());
            setupUser();
            setupEmail();
            setupSSH();
            setupRepo();
            setupLocal();
            $(".origin-href").attr("href", "https://github.com/" + Github.getUsername() + "/" + model.repo());
            $("#private-href").attr("href", "https://github.com/" + Github.getUsername() + "/" + model.repo() + "/settings");
            $("#collaborator-href").attr("href", "https://github.com/" + Github.getUsername() + "/" + model.repo() + "/settings/collaboration");
            $("#origin-code").html("git remote add origin git@github.com:" + Github.getUsername() + "/" + model.repo() + ".git");
            
            controller.update('github-authenticated', true);
        } else {
            controller.update('github-authenticated', false);
        }
    },
};
$( "#name" ).on( "change", function(event) {
    controller.name();
});
$( "#email" ).on( "change", function(event) {
    controller.email();
});
$( "#github-password" ).on( "change", function(event) {
    controller.github();
});
$( "#github-retry" ).on( "click", function(event) {
    controller.github();
});
$("#gravatar-signout").on("click", function(event) {
    controller.gravatar.logout();
});
$("#gravatar-signin").on("click", function(event) {
    controller.gravatar.login();
});
$("#github-signout").on("click", function(event) {
    logout();
});
$("#github-signin").on("click", function(event) {
    $("#github-signin").prop("disabled",true);
    login();
});

$(function() {
    $("#name").val(model.name());
    $("#email").val(model.email());
    $("#manual-github-login").prop('required',false);
    controller.name();
    controller.email();
    controller.gravatar();
    controller.github();
});

function setupLocal() {
    $.ajax({
        method: "POST",
        dataType: "json",
        crossDomain: true,
        url: 'http://localhost:8080/setup',
        data: {
            "github.login": Github.getUsername(),
            "user.name": model.name(),
            "user.email": model.email(),
        },
        success: function(response) {
            controller.update('git-name',response.status);
            controller.update('git-email',response.status);
            controller.update('git-origin', response.status));
            controller.update('git-upstream', response.status);
            controller.update('git-clone', response.status);
            controller.update('git-push', response.status);
        },
        error: function(response) {
            console.log(JSON.stringify(response));
            alert("Local server not responding.");
        }
    });

}

function setupUser() {
    // Nag the user if they're not on an upgraded plan
    Github.getUser({
        success: function(response) {
            controller.update('github-upgraded', (response.plan.name.toLowerCase() != "free"));
        }
    });
    Github.setUser({
        data: { name: model.name() },
        success: function(response) {
            controller.update('github-profile',true);
        },
        fail: function(response) {
            controller.update('github-profile',false);
        }
    });
}
function setupEmail() {
    // Setup email
    Github.getEmail({
        email: model.email(),
        verified: function(status) {
            controller.update('github-email-verified',status);
        }
    });
}
function setupSSH() {
    Github.shareKey({
        title: model.hostLogin(),
        key: model.publicKey(),
        success: function() {
            controller.update('github-key',true);
        },
        fail: function() {
            controller.update('github-key',false);
        }
    });
}
function setupRepo() {
    Github.createRepo({
        repo: model.repo(),
        success: function(response) {
            controller.update('github-repository',true);
            Github.addCollaborator({
                repo: model.repo(),
                collaborator: model.instructor(),
                success: function(response) {
                    controller.update('github-collaborator', true);
                },
                fail: function(response) {
                    controller.update('github-collaborator', false);
                }
            });
            // As long as we're not the instructor, ...
            if ($("#instructor").val() != Github.getUsername()) {
                // Make the repository private
                Github.privateRepo({
                    repo: model.repo(),
                    success: function(response) {
                        controller.update('github-private', true);
                    },
                    fail: function(response) {
                        controller.update('github-private', false);
                    }
                });
            }
        },
        fail: function(response) {
            controller.update('github-repository',false);
        }
    });
}
function login() {
    Github.login({
        username: $("#email").val(),
        password: $("#github-password").val(),
        otp: $("#otp").val(),
        authenticated: function(login) {
            controller.github();
        },
        badCredential: function() {
            // Clear the password
            $("#github-signin").prop("disabled",false);
            $("#password").attr('value', '');
            controller.github();
        },
        twoFactor: function() {
            $("#github-signin").prop("disabled",false);
            $("#password").prop("disabled", false);
            $('.github-two-factor').show();
            $('#otp').focus();
        }
    });
}
function logout() {
    Github.logout();
    $("#github-signin").prop("disabled",false);
    $("#otp").attr('value','');
    controller.update('github-authenticated', false);
}