// Quick and dirty Gitlab Javascript API wrapper

var Gitlab = {
    badCredentials: false,
    email: "",
    password: "",
    
    authenticated: function () {
        return localStorage.hasOwnProperty("Gitlab.token") && localStorage.hasOwnProperty("Gitlab.username");
    },
    
    getAuthorization: function () {
        return localStorage.getItem("Gitlab.token");
    },
    
    getUsername: function() { return localStorage.getItem("Gitlab.username"); },
    existingUser: function() { return localStorage.hasOwnProperty("Gitlab.username"); },

    // Generic Gitlab API invoker
    invoke: function (settings) {
        $.ajax({
            crossDomain: true,
            url: "https://gitlab.com/api/v3" + settings.url,
            type: settings.method,
            beforeSend: function(xhr) {
                xhr.setRequestHeader("PRIVATE-TOKEN", Gitlab.getAuthorization());
            },
            dataType: "json",
            data: settings.data,
            success: settings.success,
            error: settings.fail
        });
    },

    // Login to Gitlab
    // Gitlab.login({ 
    //  authenticated: function() { /* Do this when authenticated */ },
    //  badCredential: function() { /* Do this if we have a bad credential */ },
    // })
    login: function(settings) {
        Gitlab.email = settings.email;
        Gitlab.password = settings.password;
        if (Gitlab.authenticated()) {
            settings.authenticated();
        } else {
            $.ajax({
                crossDomain: true,
                url: "https://gitlab.com/api/v3/session",
                type: "POST",
                dataType: "json",
                data: { "email": Gitlab.email, "password": Gitlab.password },
                success: function(response) {
                    localStorage.setItem("Gitlab.username",response.username);
                    localStorage.setItem("Gitlab.token",response.private_token);
                    
                    settings.authenticated();
                },
                error: function(response) {
                    Gitlab.badCredentials = true;
                    settings.badCredential();
                }
            });
        }
    },
    
    logout: function() {
        localStorage.removeItem('Gitlab.token');
    },
    
    // Gitlab.shareKey({
    // key: "Public SSH key here",
    // title: "some title here",
    // success: function() {/* what to do if it worked */},
    // fail: function() {/* what to do if it didn't */}
    //});
    shareKey: function(settings) {
        Gitlab.invoke({
            url: "/user/keys",
            method: "GET",
            data: {},
            success: function(response) {
                settings.success(response);
                for (index in response) {
                    if (response[index].key == settings.key) {
                        settings.success(response);
                        return;
                    }
                }
                // Send key
                Gitlab.invoke({
                    url: "/user/keys",
                    method: "POST",
                    data: {
                        title: settings.title,
                        key: settings.key
                    },
                    success: settings.success,
                    fail: settings.fail
                });
            },
            fail: settings.fail
        });
    },
    
    getUser: function(settings) {
        Gitlab.invoke({
            url: "/user",
            method: "GET",
            data: {},
            success: settings.success,
            fail: settings.fail
        });
    },
    
    // Find a user by name
    getUserByName: function(settings) {
        Gitlab.invoke({
            url: "/users?search="+settings.user,
            method: "GET",
            data: {},
            success: settings.success,
            fail: settings.fail
        });
    },

    nameShared: false,
    emailVerified: false,
    keyShared: false,

    setupAccount: function(settings) {
        // Onboarding/authentication status
        settings.callback("gitlab-onboard", !Gitlab.existingUser());
        settings.callback('gitlab-authenticated', Gitlab.authenticated());
        if (Gitlab.authenticated()) {
            // Nag the user if they didn't share their name or email
            if (!Gitlab.nameShared || !Gitlab.emailVerified) { 
                Gitlab.getUser({
                    success: function(response) {
                        Gitlab.nameShared = response.name == settings.name;
                        Gitlab.emailVerified = response.email == settings.email;
                        settings.callback('gitlab-profile', Gitlab.nameShared);
                        settings.callback('gitlab-email-verified', Gitlab.emailVerified);
                    }
                });
            }
            // Share key
            if (!Gitlab.keyShared) {
                Gitlab.shareKey({
                    title: settings.title,
                    key: settings.key,
                    success: function() {
                        Gitlab.keyShared = true;
                        settings.callback('gitlab-key',true);
                    },
                });
            }
        }
    },

    // Gitlab.createRepo({
    // repo: Repository name,
    // success: function() {/* what to do if it worked */},
    // fail: function() {/* what to do if it didn't */}
    //});
    createRepo: function(settings) {
        Gitlab.invoke({
            url: "/projects/" + Gitlab.getUsername() + "%2F" + settings.repo.toLowerCase(),
            method: "GET",
            data: {},
            // If the repo is created already, we're done
            success: settings.success,
            // Otherwise, we need to make it
            fail: function(response) {
                Gitlab.invoke({
                    url: "/projects",
                    method: "POST",
                    data: {
                        name: settings.repo,
                        "public": false,
                        visibility_level: 0
                        // you could also set the import_url so something public
                    },
                    success: settings.success,
                    fail: settings.fail
                });
            }
        });
    },
    
    // Gitlab.addCollaborator({
    // repo: Repository name,
    // collaborator: a collaborator,
    // success: function() {/* what to do if it worked */},
    // fail: function() {/* what to do if it didn't */}
    //});
    addCollaborator: function(settings) {
        var url = "/projects/" + Gitlab.getUsername() + "%2F" + settings.repo.toLowerCase() + "/members";
        Gitlab.getUserByName({
            user: settings.collaborator,
            success: function(response) {
                Gitlab.invoke({
                    method: "PUT",
                    "url": url,
                    data: {
                        "id": Gitlab.getUsername() + "%2F" + settings.repo.toLowerCase(),
                        "user_id": response[0].id,
                        // See: https://gitlab.com/help/permissions/permissions
                        "access_level": 30 // Developer
                    },
                    success: settings.success,
                    fail: settings.fail
                });
            },
            fail: settings.fail
        });
    },
}