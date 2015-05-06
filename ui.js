
// Show commands in textarea
function updateCommands() {
    var value = "";
    // Configure git
    if (user.name.changed() && user.name.isValid()) {
        value += "git config --global user.name \"" + user.get("name") + "\"\n";
    }
    if (user.email.changed() && user.email.isValid()) {
        value += "git config --global user.email " + user.get("email") + "\n";
    }
    // Create public/private SSH keypair
    if (!user.key.isValid()) {
        value += "printf \"\\n\" | ssh-keygen -t rsa -N ''\n"
    }
    // Enter home directory
    value += "cd ~";
    // Create repository
    if ($("#cloned").val() != "true") {
        value += "\ngit init " + model.repo();
    }
    // Enter repository
    value += "\ncd " + model.repo();
    // Configure upstream
    if (!model.hasRemote('upstream')) {
        value += "\ngit remote add upstream \\";
        value += "\n" + model.upstream() + ".git";
    }
    if (Bitbucket.existingUser() && !model.hasRemote('bitbucket')) {
        value += "\ngit remote add bitbucket \\";
        value += "\ngit@bitbucket.org:" + ((Bitbucket.getUsername() == null) ? user.get("login") : Bitbucket.getUsername()) + "/" + model.repo() + ".git";
    }
    // Add origin
    var origin = host.getOrigin();
    if (origin && !model.hasRemote('origin')) {
        value += "\ngit remote add origin \\";
        value += "\ngit@" + origin.getHostname() + ":" + ((origin.getUsername() == null) ? user.get("login") : origin.getUsername()) + "/" + model.repo() + ".git";
    }
    
    // Configure remotes
    for (var key in Gitlab.collaborators) {
        if (!model.hasRemote(key + "-gitlab")) {
            value += "\ngit remote add " + key + "-gitlab \\\ngit@gitlab.com:" + key + "/" + model.repo() + ".git";
        }
    }
    for (var key in Github.collaborators) {
        if (!model.hasRemote(key + "-github")) {
            value += "\ngit remote add " + key + "-github \\\ngit@github.com:" + key + "/" + model.repo() + ".git";
        }
    }
    // Fetch everything
    value += "\ngit fetch --all";
    value += "\ngit merge upstream/master";
    value += "\ngit submodule update --init --recursive";
    // Push to origin
    if (origin) {
        value += "\ngit push -u origin master\n# Done";
    }
    $("#command-line").val(value);
}

// Validate profile, outlining broken fields in red
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

// Setup all accounts
function setupAccounts() {
    var hosts = [ Github, Gitlab ];
    var settings = {
        title: user.get("login") + "@" + user.get("host"),
        key: user.get("key"),
        name: user.get("name"),
        email: user.get("email"),
        callback: controller.update,
    };
    for (var i = 0; i < hosts.length; i++) {
        hosts[i].setupAccount(settings);
    }
}

function updateView(event) {
    validateUser();
    setupAccounts();

    // Gravatar
    $("#gravatar").attr('src', 'http://www.gravatar.com/avatar/' + user.gravatar.value() + '?d=retro&s=140');
    user.gravatar.checkValid(function(status) {
        controller.update('gravatar-account',status);
    });

    // Don't allow sign-in unless their email is valid
    $("#github-signin").prop("disabled", !user.email.isValid());
    $("#gitlab-signin").prop("disabled", !user.email.isValid());
//    $("#bitbucket-signin").prop("disabled", !user.email.isValid());

    // Update repository URLs
    if (Github.existingUser()) {
        $('#github-login').text(Github.getUsername());
        $(".github-repo-href").attr("href", Github.repoURL());
        $("#github-collaborator-href").attr("href", Github.repoURL() + "/settings/collaboration");
        $("#github-private-href").attr("href", Github.repoURL() + "/settings");
    }
    if (Gitlab.existingUser()) {
        $('#gitlab-login').text(Gitlab.getUsername());
        $(".gitlab-repo-href").attr("href", Gitlab.repoURL());
        $("#gitlab-collaborator-href").attr("href", Gitlab.repoURL() + "/project_members");
        $("#gitlab-private-href").attr("href", Gitlab.repoURL() + "/edit");
    }
    if (Bitbucket.existingUser()) {
        controller.update('bitbucket-repository', true);
        $("#bitbucket-user").attr("href", "https://bitbucket.org/account/user/" + Bitbucket.getUsername() + "/");
        $("#bitbucket-email").attr("href", "https://bitbucket.org/account/user/" + Bitbucket.getUsername() + "/email/");
        $("#bitbucket-ssh").attr("href", "https://bitbucket.org/account/user/" + Bitbucket.getUsername() + "/ssh-keys/");
        $(".bitbucket-repo-href").attr("href", Bitbucket.repoURL());
        $("#bitbucket-collaborator-href").attr("href", Bitbucket.repoURL() + "/admin/access");
        $("#bitbucket-private-href").attr("href", Bitbucket.repoURL() + "/admin");
    }
    Github.getCollaborators({
        page: 1,
        success: function(collaborators) {
            for (var key in collaborators) {
                $("#repositories").append("<li><i class=\"fa fa-li fa-lg fa-github\"></i><a id=\"github-collaborator-"+ key +"\" href=\"https://github.com/"+ key + "/" + model.repo() + "\" target=\"_blank\">" + collaborators[key] + "'s repository</a></li>");
            }
            updateCommands();
        },
        callback: function(key, value) {
            $("#github-collaborator-" + key).text(value + "'s repository");
        },
        fail: function() {}
    });
    Gitlab.getCollaborators({
        success: function(collaborators) {
            for (var key in collaborators) {
                $("#repositories").append("<li><i class=\"fa fa-li fa-lg fa-git-square\"></i><a href=\"https://gitlab.com/"+ key + "/" + model.repo() + "\" target=\"_blank\">" + collaborators[key] + "'s repository</a></li>");
            }
            updateCommands();
        },
        fail: function() {}
    });
    
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
$( "#gitlab-password" ).on( "change", updateView );

$("#github-signout").on("click", function(event) {
    Github.logout();
    $("#github-signin").prop("disabled",false);
    $("#otp").val('');
    $("#github-password").val('');
    $("#github-password").removeAttr('style');
    $("#otp").hide();
    controller.update('github-authenticated', false);
});

function GithubSignin(event) {
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
}

$("#github-signin").on("click", GithubSignin);

$('#github-password').keypress(function (e) {
  if (e.which == 13) {
    GithubSignin(e);
  }
});

$('#otp').keypress(function (e) {
  if (e.which == 13) {
    GithubSignin(e);
  }
});

function GitlabSignin(event) {
    $("#gitlab-signin").prop("disabled",true);
    Gitlab.login({
        email: user.email.value(),
        password: $("#gitlab-password").val(),
        authenticated: function(login) {
            updateView();
        },
        badCredential: function() {
            $("#gitlab-signin").prop("disabled",false);
            $("#gitlab-password").val('');
            $("#gitlab-password").css('border-color','red');
            updateView();
        },
    });
}

$("#gitlab-signin").on("click", GitlabSignin);

$('#gitlab-password').keypress(function (e) {
  if (e.which == 13) {
    GitlabSignin(e);
  }
});

$("#bitbucket-signin").on("click", function(event) {
    updateView();
});

$("#bitbucket-login").keypress(function (e) {
  if (e.which == 13) {
    updateView();
  }
});

$("#gitlab-signout").on("click", function(event) {
    Gitlab.logout();
    $("#gitlab-signin").prop("disabled",false);
    $("#gitlab-password").val('');
    $("#gitlab-password").removeAttr('style');
    controller.update('gitlab-authenticated', false);
});

$(function() {
    // Show values from local storage, if available
    $("#name").val(user.get("name"));
    $("#email").val(user.get("email"));
    updateView();
});

$("#local-setup-button").on("click", function(event) {
    $("#local-setup-button").prop("disabled",true);
    setupLocal();
});

function setupLocal() {
    // Information to pass to the server
    var data = {
        "github.login": Github.getUsername(),
        "gitlab.login": Gitlab.getUsername(),
        "bitbucket.login": Bitbucket.getUsername(),
        "user.name": user.get("name"),
        "user.email": user.get("email"),
    };
    $.extend(data, Github.collaborators);
    $.extend(data, Gitlab.collaborators);
    $.ajax({
        method: "POST",
        dataType: "json",
        crossDomain: true,
        url: 'http://localhost:8080/setup',
        data: data,
        success: function(response) {
            $("#stored-name").val(response.name);
            $("#stored-email").val(response.email);
            $("#cloned").val();
            updateView();
            controller.update('git-status',response.status);
        },
        error: function(response) {
            alert("Local server not responding.");
        }
    });
}
