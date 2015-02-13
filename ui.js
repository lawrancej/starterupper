var model = {
    // Name of the repository
    repo: function()       { return $("#repository").val(); },
    // Who's the instructor? (i.e., github login)
    instructor: function() { return $("#instructor").val(); },
};

function updateCommands() {
    var value = "## Configure git";
    if (user.name.changed() && user.name.isValid()) {
        value += "\ngit config --global user.name \"" + user.get("name") + "\"";
    }
    if (user.email.changed() && user.email.isValid()) {
        value += "\ngit config --global user.email " + user.get("email");
    }
    if (!user.name.changed() && !user.email.changed() && user.email.isValid() && user.name.isValid()) {
        value += " (DONE)";
    }
    if (!user.key.isValid()) {
        value += "\n## Create public/private SSH key pair"
        value += "\nprintf \"\\n\" | ssh-keygen -t rsa -N ''"
    }
    value += "\n## Clone repository";
    if ($("#cloned").val() == "true") {
        value += " (DONE)";
        value += "\ncd ~/" + model.repo();
    } else {
        value += "\ncd && git clone \\";
        value += "\nhttps://github.com/" + model.instructor() + "/" + model.repo() + ".git";
        value += "\ncd " + model.repo();
        value += "\ngit submodule update --init --recursive";
    }
    value += "\n## Configure remote repositories";
    if ($("#stored-github").val() != Github.getUsername()) {
        value += "\ngit remote add upstream \\";
        value += "\nhttps://github.com/" + model.instructor() + "/" + model.repo() + ".git";
        value += "\ngit remote rm origin";
        value += "\ngit remote add origin \\";
        value += "\ngit@github.com:" + ((Github.getUsername() == null) ? user.get("login") : Github.getUsername()) + "/" + model.repo() + ".git";
    } else {
        value += " (DONE)";
    }
    value += "\n## Push to origin";
    value += "\ngit push -u origin master";
    $("#command-line").val(value);
}

function validateUser() {
    var fields = [ user.name, user.email, user.key, user.gravatar ];
    var id = [ "#name", "#email", "#public-key", "#gravatar" ];
    var i;
    var allValid = true;
    for (i = 0; i < fields.length; i++) {
        if (fields[i].isValid()) {
            $(id[i]).removeAttr('style');
            allValid = false;
        }
        else {
            $(id[i]).css('border-color','red');
        }
    }
    return allValid;
}

function updateView(event) {
    validateUser();

    $("#gravatar").attr('src', 'http://www.gravatar.com/avatar/' + user.gravatar.value() + '?d=retro&s=140');
    user.gravatar.checkValid(function(status) {
        controller.update('gravatar-account',status);
    });

    Github.setupAccount({
        title: user.get("login") + "@" + user.get("host"),
        key: user.get("key"),
        name: user.get("name"),
        email: user.get("email"),
        callback: controller.update,
    });
    controller.update("github-onboard",!localStorage.hasOwnProperty("Github.username"));
    controller.update('github-authenticated', Github.authenticated());
    $("#github-signin").prop("disabled", !user.email.isValid());
    if (localStorage.hasOwnProperty("Github.username")) {
        $(".origin-href").attr("href", "https://github.com/" + Github.getUsername() + "/" + model.repo());
        $("#private-href").attr("href", "https://github.com/" + Github.getUsername() + "/" + model.repo() + "/settings");
        $("#collaborator-href").attr("href", "https://github.com/" + Github.getUsername() + "/" + model.repo() + "/settings/collaboration");
    }

    $("#gitlab-signin").prop("disabled", !user.email.isValid());
    $("#bitbucket-signin").prop("disabled", !user.email.isValid());

    updateCommands();
};

var controller = {
    // Show class and hide its opposite
    update: function(klass, value) {
        $(((value) ? "." : ".no-")+klass).show();
        $(((value) ? ".no-" : ".")+klass).hide();
        localStorage.setItem(klass, value);
    },
};

$( "#name" ).on( "change", updateView );
$( "#email" ).on( "change", updateView );
$( "#github-password" ).on( "change", updateView );

$("#github-signout").on("click", function(event) {
    Github.logout();
    $("#github-signin").prop("disabled",false);
    $("#otp").val('');
    $("#github-password").val('');
    $("#github-password").removeAttr('style');
    $("#otp").hide();
    controller.update('github-authenticated', false);
});

$("#github-signin").on("click", function(event) {
    $("#github-signin").prop("disabled",true);
    Github.login({
        username: user.email.value(),
        password: $("#github-password").val(),
        otp: $("#otp").val(),
        authenticated: function(login) {
            updateView();
        },
        badCredential: function() {
            $("#github-signin").prop("disabled",false);
            $("#github-password").val('');
            $("#github-password").css('border-color','red');
            updateView();
        },
        twoFactor: function() {
            $("#github-signin").prop("disabled",false);
            $("#github-password").prop("disabled", false);
            $("#github-password").removeAttr('style');
            $("#github-forgot").hide();
            $('.github-two-factor').show();
            $('#otp').focus();
        }
    });
});

$(function() {
    // Show values from local storage, if available
    $("#name").val(user.get("name"));
    $("#email").val(user.get("email"));
    updateView();
});

function setupLocal() {
    $.ajax({
        method: "POST",
        dataType: "json",
        crossDomain: true,
        url: 'http://localhost:8080/setup',
        data: {
            "github.login": Github.getUsername(),
            "user.name": user.get("name"),
            "user.email": user.get("email"),
        },
        success: function(response) {
            $("#stored-name").val(response.name);
            $("#stored-email").val(response.email);
            $("#stored-github").val(response.github);
            $("#cloned").val();
            updateView();
            controller.update('git-status',response.status);
        },
        error: function(response) {
            alert("Local server not responding.");
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
            });
            // As long as we're not the instructor, ...
            if ($("#instructor").val() != Github.getUsername()) {
                // Make the repository private
                Github.privateRepo({
                    repo: model.repo(),
                    success: function(response) {
                        controller.update('github-private', true);
                    },
                });
            }
        },
    });
}
