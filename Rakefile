require 'rake'
require 'rake/packagetask'
require 'rbconfig'
require 'yaml'

module PrototypeHelper
  extend Rake::DSL

  ROOT_DIR      = File.expand_path(File.dirname(__FILE__))
  SRC_DIR       = File.join(ROOT_DIR, 'src')
  DIST_DIR      = File.join(ROOT_DIR, 'dist')
  DOC_DIR       = File.join(ROOT_DIR, 'doc')
  TEMPLATES_DIR = File.join(ROOT_DIR, 'templates')
  PKG_DIR       = File.join(ROOT_DIR, 'pkg')
  TEST_DIR      = File.join(ROOT_DIR, 'test')
  TEST_UNIT_DIR = File.join(TEST_DIR, 'unit')
  TMP_DIR       = File.join(TEST_UNIT_DIR, 'tmp')
  VERSION       = YAML.load(IO.read(File.join(SRC_DIR, 'constants.yml')))['PROTOTYPE_VERSION']

  host = RbConfig::CONFIG['host']
  IS_WINDOWS = host.include?('mswin') || host.include?('mingw32')

  # Possible options for PDoc syntax highlighting, in order of preference.
  SYNTAX_HIGHLIGHTERS = [:pygments, :coderay, :none]

  %w[sprockets pdoc unittest_js caja_builder].each do |name|
    $:.unshift File.join(PrototypeHelper::ROOT_DIR, 'vendor', name, 'lib')
  end

  def self.has_git?
    begin
      `git --version`
      return true
    rescue Error
      return false
    end
  end

  def self.require_git
    return if has_git?
    puts "\nPrototype requires Git in order to load its dependencies."
    puts "\nMake sure you've got Git installed and in your path."
    puts "\nFor more information, visit:\n\n"
    puts "  http://git-scm.com/book/en/v2/Getting-Started-Installing-Git"
    exit
  end

  def self.sprocketize(options = {})
    options = {
      :destination    => File.join(DIST_DIR, options[:source]),
      :strip_comments => true
    }.merge(options)

    require_sprockets
    load_path = [SRC_DIR]

    secretary = Sprockets::Secretary.new(
      :root           => File.join(ROOT_DIR, options[:path]),
      :load_path      => load_path,
      :source_files   => [options[:source]],
      :strip_comments => options[:strip_comments]
    )

    secretary.concatenation.save_to(options[:destination])
  end

  def self.build_doc_for(file)
    rm_rf(DOC_DIR)
    mkdir_p(DOC_DIR)
    hash = current_head
    index_header = <<EOF
<h1 style="margin-top: 31px; height: 75px; padding: 1px 0; background: url(images/header-stripe-small.png) repeat-x;">
  <a href="http://prototypejs.org" style="padding-left: 120px;">
    <img src="images/header-logo-small.png" alt="Prototype JavaScript Framework API" />
  </a>
</h1>
EOF
    PDoc.run({
      :source_files => Dir[File.join('src', 'prototype', '**', '*.js')],
      :destination  => DOC_DIR,
      :index_page   => 'README.markdown',
      :syntax_highlighter => syntax_highlighter,
      :markdown_parser    => :bluecloth,
      :src_code_text => "View source on GitHub &rarr;",
      :src_code_href => proc { |obj|
        "https://github.com/sstephenson/prototype/blob/#{hash}/#{obj.file}#L#{obj.line_number}"
      },
      :pretty_urls => false,
      :bust_cache  => false,
      :name => 'Prototype JavaScript Framework',
      :short_name => 'Prototype',
      :home_url => 'http://prototypejs.org',
      :version => PrototypeHelper::VERSION,
      :index_header => index_header,
      :footer => 'This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by-sa/3.0/">Creative Commons Attribution-Share Alike 3.0 Unported License</a>.',
      :assets => 'doc_assets'
    })
  end

  def self.require_package(name)
    begin
      require name
    rescue LoadError
      puts "You need the #{name} package. Try installing it with:\n"
      puts "  $ gem install #{name}"
      exit
    end
  end

  def self.require_phantomjs
    cmd = IS_WINDOWS ? "phantomjs.cmd -v" : "phantomjs -v > /dev/null 2>&1"
    success = system(cmd)
    if !success
      puts "\nYou need phantomjs installed to run this task. Find out how at:"
      puts "  http://phantomjs.org/download.html"
      exit
    end
  end

  def self.syntax_highlighter
    if ENV['SYNTAX_HIGHLIGHTER']
      highlighter = ENV['SYNTAX_HIGHLIGHTER'].to_sym
      require_highlighter(highlighter, true)
      return highlighter
    end

    SYNTAX_HIGHLIGHTERS.detect { |n| require_highlighter(n) }
  end

  def self.require_highlighter(name, verbose=false)
    case name
    when :pygments
      success = system("pygmentize -V > /dev/null")
      if !success && verbose
        puts "\nYou asked to use Pygments, but I can't find the 'pygmentize' binary."
        puts "To install, visit:\n"
        puts "  http://pygments.org/docs/installation/\n\n"
        exit
      end
      return success # (we have pygments)
    when :coderay
      begin
        require 'coderay'
      rescue LoadError
        if verbose
          puts "\nYou asked to use CodeRay, but I can't find the 'coderay' gem. Just run:\n\n"
          puts "  $ gem install coderay"
          puts "\nand you should be all set.\n\n"
          exit
        end
        return false
      end
      return true # (we have CodeRay)
    when :none
      return true
    else
      puts "\nYou asked to use a syntax highlighter I don't recognize."
      puts "Valid options: #{SYNTAX_HIGHLIGHTERS.join(', ')}\n\n"
      exit
    end
  end

  def self.require_sprockets
    require_submodule('Sprockets', 'sprockets')
  end

  def self.require_pdoc
    require_submodule('PDoc', 'pdoc')
  end

  def self.require_unittest_js
    require_submodule('UnittestJS', 'unittest_js')
  end

  def self.require_caja_builder
    require_submodule('CajaBuilder', 'caja_builder')
  end

  def self.get_submodule(name, path)
    require_git
    puts "\nYou seem to be missing #{name}. Obtaining it via git...\n\n"

    Kernel.system("git submodule init")
    return true if Kernel.system("git submodule update vendor/#{path}")
    # If we got this far, something went wrong.
    puts "\nLooks like it didn't work. Try it manually:\n\n"
    puts "  $ git submodule init"
    puts "  $ git submodule update vendor/#{path}"
    false
  end

  def self.require_submodule(name, path)
    begin
      full_path = File.join(PrototypeHelper::ROOT_DIR, 'vendor', path, 'lib', path)
      # We need to require the explicit version in the submodule.
      require full_path
    rescue LoadError => e
      # Wait until we notice that a submodule is missing before we bother the
      # user about installing git. (Maybe they brought all the files over
      # from a different machine.)
      missing_file = e.message.sub('no such file to load -- ', '').sub('cannot load such file -- ', '')
      if missing_file == full_path
        # Missing a git submodule.
        retry if get_submodule(name, path)
      else
        # Missing a gem.
        puts "\nIt looks like #{name} is missing the '#{missing_file}' gem. Just run:\n\n"
        puts "  $ gem install #{missing_file}"
        puts "\nand you should be all set.\n\n"
      end
      exit
    end
  end

  def self.current_head
    `git show-ref --hash HEAD`.chomp[0..6]
  end
end

task :default => [:dist, :dist_helper, :package, :clean_package_source]

desc "Builds the distribution."
task :dist do
  PrototypeHelper.sprocketize(
    :path => 'src',
    :source => 'prototype.js'
  )
end

namespace :doc do
  desc "Builds the documentation."
  task :build => [:require] do
    PrototypeHelper.build_doc_for(ENV['SECTION'] ? "#{ENV['SECTION']}.js" : 'prototype.js')
  end

  task :require do
    PrototypeHelper.require_pdoc
  end
end

task :doc => ['doc:build']

desc "Builds the updating helper."
task :dist_helper do
  PrototypeHelper.sprocketize(:path => 'ext/update_helper', :source => 'prototype_update_helper.js')
end

Rake::PackageTask.new('prototype', PrototypeHelper::VERSION) do |package|
  package.need_tar_gz = true
  package.package_dir = PrototypeHelper::PKG_DIR
  package.package_files.include(
    '[A-Z]*',
    'dist/prototype.js',
    'lib/**',
    'src/**',
    'test/**'
  )
end

task :clean_package_source do
  rm_rf File.join(PrototypeHelper::PKG_DIR, "prototype-#{PrototypeHelper::VERSION}")
end

task :test => ['test:require', 'test:start']
namespace :test do
  desc 'Starts the test server.'
  task :start => [:require] do
    path_to_app = File.join(PrototypeHelper::ROOT_DIR, 'test', 'unit', 'server.rb')
    require path_to_app

    puts "Starting unit test server..."
    puts "Unit tests available at <http://127.0.0.1:4567/test/>\n\n"
    UnitTests.run!
  end

  task :require do
    PrototypeHelper.require_package('sinatra')
  end

  desc "Opens the test suite in several different browsers. (Does not start or stop the server; you should do that separately.)"
  task :run => [:require] do
    browsers, tests, grep = ENV['BROWSERS'], ENV['TESTS'], ENV['GREP']
    path_to_runner = File.join(PrototypeHelper::ROOT_DIR, 'test', 'unit', 'runner.rb')
    require path_to_runner

    Runner::run(browsers, tests, grep)
  end

  desc "Runs the tests in PhantomJS. (Does not start or stop the server; you should do that separately.)"
  task :phantom do
    PrototypeHelper.require_phantomjs
    tests, grep = ENV['TESTS'], ENV['GREP']
    url = "http://127.0.0.1:4567/test/#{tests}"
    url << "?grep=#{grep}" if grep
    system(%Q[phantomjs ./test/unit/phantomjs/mocha-phantomjs.js "#{url}"])
  end
end
