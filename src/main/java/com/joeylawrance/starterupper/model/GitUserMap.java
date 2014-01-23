package com.joeylawrance.starterupper.model;

import java.io.File;
import java.io.IOException;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.apache.commons.lang3.ObjectUtils;

import org.eclipse.jgit.errors.ConfigInvalidException;
import org.eclipse.jgit.storage.file.FileBasedConfig;
import org.eclipse.jgit.util.FS;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * A map for git user name and email, backed by ~/.gitconfig
 * 
 * @author Joey Lawrance
 *
 */
public class GitUserMap implements Map<GitUserMap.Profile, String> {
	public static enum Profile {
		// Only name and email are part of git
		firstname, lastname, name, defaultname, email;
	}

	private static final Set<Profile> set = new HashSet<Profile>();
	static {
		set.addAll(Arrays.asList(Profile.values()));
	}

	private static final Logger logger = LoggerFactory.getLogger(GitUserMap.class);
	private static class SingletonHolder {
		public static final FileBasedConfig INSTANCE;
		static {
			INSTANCE = new FileBasedConfig(new File(new File(System.getProperty("user.home")), ".gitconfig"), FS.detect());
			try {
				INSTANCE.load();
				logger.info("Loaded global .gitconfig file.");
			} catch (IOException e) {
				logger.error("Can't read global .gitconfig file, even though it exists.");
			} catch (ConfigInvalidException e) {
				logger.error("Global .gitignore file is improperly formatted.");
			}
		}
	}
	private static FileBasedConfig getConfig() {
		return SingletonHolder.INSTANCE;
	}
	public GitUserMap() {
		if (this.get(Profile.defaultname) == null) {
			this.put(Profile.defaultname, System.getProperty("user.name"));
		}
	}
	private String getCustomProperty(String section, String subsection, String key) {
		return getConfig().getString(section, subsection, key);
	}
	private void setCustomProperty(String section, String subsection, String key, String value) {
		// Don't save anything outside the purview of the git user model.
		// Save changes only if necessary.
		if (!ObjectUtils.equals( getCustomProperty(section, subsection, key), value ) ) {
			logger.info("git config --global user.{} {}", key, value);
			getConfig().setString(section, subsection, key, value);
			save();
		}
	}
	private void save() {
		try {
			getConfig().save();
			logger.info("Saved changes to .gitconfig.");
		} catch (Exception e) {
			logger.error("Sorry, another program has locked your .gitconfig file in {}.", System.getProperty("user.home"));
		}
	}
	@Override
	public void clear() {
		// Nope.
	}
	@Override
	public boolean containsKey(Object key) {
		return this.get(key) != null;
	}
	@Override
	public boolean containsValue(Object value) {
		// Nope.
		return false;
	}
	@Override
	public Set<java.util.Map.Entry<Profile, String>> entrySet() {
		// Nope.
		return null;
	}
	@Override
	public String get(Object key) {
		return getCustomProperty("user", null, key.toString());
	}
	@Override
	public boolean isEmpty() {
		return false;
	}
	@Override
	public Set<Profile> keySet() {
		return set;
	}
	@Override
	public String put(Profile key, String value) {
		setCustomProperty("user", null, key.name(), value);
		return getCustomProperty("user", null, key.toString());
	}
	@Override
	public void putAll(Map<? extends Profile, ? extends String> m) {
	}
	@Override
	public String remove(Object key) {
		// Nope
		return null;
	}
	@Override
	public int size() {
		// Lie
		return 5;
	}
	@Override
	public Collection<String> values() {
		// Nope
		return null;
	}
}
