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
    // Update command-line
    updateCommands: function() {
        var value = "## Configure git";
        if ($("#stored-name").val() != model.name()) {
            value += "\ngit config --global user.name \"" + model.name() + "\"";
        }
        if ($("#stored-email").val() != model.email()) {
            value += "\ngit config --global user.email " + model.email();
        }
        if ($("#stored-email").val() == model.email() &&
            $("#stored-name").val() == model.name() &&
            model.email() != "" &&
            model.name() != "") {
            value += " (DONE)";
        }
        if (model.publicKey() == "") {
            // Only happens when things go horribly wrong
            value += "\n## Create public/private SSH keypair"
            value += "\nssh-keygen -t rsa -N ''"
        }
        value += "\n## Clone repository";
        if ($("#cloned").val() == "false") {
            value += "\ncd && git clone https://github.com/" + model.instructor() + "/" + model.repo() + ".git";
            value += "\ncd " + model.repo();
            value += "\ngit submodule update --init --recursive";
        } else {
            value += " (DONE)";
            value += "\ncd ~/" + model.repo();
        }
        value += "\n## Configure remote repositories";
        if ($("#stored-github").val() != Github.getUsername()) {
            value += "\ngit remote add upstream https://github.com/" + model.instructor() + "/" + model.repo() + ".git";
            value += "\ngit remote rm origin";
            value += "\ngit remote add origin git@github.com:" + ((Github.getUsername() == null) ? $("#stored-github").val() : Github.getUsername()) + "/" + model.repo() + ".git";
        } else {
            value += " (DONE)";
        }
        value += "\n## Push to origin";
        value += "\ngit push -u origin master";
        $("#command-line").val(value);
    },
    // Update name view on change
    name: function() {
        controller.updateCommands();
    },
    // Update email view on change
    email: function() {
        controller.updateCommands();
        
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
    github: function() {
        if (Github.authenticated()) {
            controller.updateCommands();
            setupUser();
            setupEmail();
            setupSSH();
            setupRepo();
            $(".origin-href").attr("href", "https://github.com/" + Github.getUsername() + "/" + model.repo());
            $("#private-href").attr("href", "https://github.com/" + Github.getUsername() + "/" + model.repo() + "/settings");
            $("#collaborator-href").attr("href", "https://github.com/" + Github.getUsername() + "/" + model.repo() + "/settings/collaboration");
            
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
    controller.name();
    controller.email();
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
            $("#stored-name").val(response.name);
            $("#stored-email").val(response.email);
            $("#stored-github").val(response.github);
            $("#cloned").val();
            controller.updateCommands();
            controller.update('git-status',response.status);
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
            setupLocal();
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
            $("#password").removeAttr('style');
        },
        badCredential: function() {
            // Clear the password
            $("#github-signin").prop("disabled",false);
            $("#password").attr('value', '');
            $("#password").css('border-color','red');
            controller.github();
        },
        twoFactor: function() {
            $("#github-signin").prop("disabled",false);
            $("#password").prop("disabled", false);
            $("#password").removeAttr('style');
            $("#github-forgot").hide();
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