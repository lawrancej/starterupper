var user = {
  get: function(field) {
    if (user[field].isValid()) {
        localStorage.setItem("User." + field, user[field].value());
        return user[field].value();
    }
    return localStorage.getItem("User." + field);
  },
  login: {
    value: function() { return $("#login").val(); },
    isValid: function() { return !/USER_NAME/.test(user.login.value()) && user.login.value().length > 0; },
  },
  host: {
    value: function() { return $("#host").val(); },
    isValid: function() { return user.login.value().length > 0; },
  },
  key : {
    value: function() { return $("#public-key").val(); },
    isValid: function() { return /ssh-rsa .*/.test(user.key.value()); },
  },
  name : {
    value: function() { return $("#name").val().trim(); },
    isValid: function() { return /[^ ]+( [^ ]+)+/.test(user.name.value()); },
    changed: function() { return $("#stored-name").val() != user.name.value(); },
  },
  email : {
    isValid: function() { return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(user.email.value()) && /edu$/.test(user.email.value()); },
    value: function() { return $("#email").val().toLowerCase().trim(); },
    changed: function() { return $("#stored-email").val() != user.email.value(); },
  },
  gravatar : {
    value: function() { return SparkMD5.hash(user.get("email")); },
    changed: function() { return user.gravatar.value() != localStorage.getItem("Gravatar"); },
    isValid: function() { return localStorage.hasOwnProperty("Gravatar"); },
    checkValid: function(callback) {
        if (user.gravatar.changed()) {
            $.ajax({
                method: "GET",
                dataType: "jsonp",
                crossDomain: true,
                processData: false,
                url: 'https://en.gravatar.com/' + user.gravatar.value() + '.json',
                success: function(response) {
                    localStorage.setItem("Gravatar", user.gravatar.value());
                    callback(true);
                },
                error: function(response) {
                    localStorage.removeItem("Gravatar");
                    callback(false);
                }
            });
        } else {
            callback(user.gravatar.isValid());
        }
    },
  },
};
